import Boom from '@hapi/boom'
import { load } from 'cheerio'
import { wreck } from '../common/helpers/wreck-client.js'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import {
  COMMENT_INVALID_CHARACTERS_ERROR,
  COMMENT_TOO_LONG_ERROR,
  MAX_COMMENT_LENGTH
} from '../common/helpers/habitat-comment.js'
import {
  createMockH,
  featureId,
  isProjectUrl,
  projectId,
  projectPayload
} from './controller-test-helpers.js'
import {
  createdAreaFeature,
  creationReference
} from './created-area-test-fixtures.js'
import {
  createdHedgerowFeature,
  hedgerowCreationReference
} from './created-hedgerow-test-fixtures.js'
import {
  createdWatercourseFeature,
  watercourseCreationReference
} from './created-watercourse-test-fixtures.js'
import {
  createdTree,
  treeCreationReference
} from './created-tree-test-fixtures.js'
import {
  createdAreaValues,
  _resetCreatedAreaReferenceCache
} from './created-area-edit.js'
import { CREATED_SUPPORTING_INFORMATION_HINT } from './constants.js'
import { getController, postController } from './controller.js'

// BMD-1153: a Created area habitat, tree, hedgerow and watercourse's edit page
// has a "Supporting information" box, with the baseline page's rules
// (BMD-1112).

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), put: vi.fn() }
}))

const EDIT_TEMPLATE = 'habitat-details/pi-habitat-details-created-edit'
const SAVED_COMMENT = 'Saved note\nwith a break'
const OVER_LIMIT = 'a'.repeat(MAX_COMMENT_LENGTH + 1)

const REFERENCES = {
  '/reference/area-creation': creationReference,
  '/reference/tree-creation': treeCreationReference,
  '/reference/hedgerow-creation': hedgerowCreationReference,
  '/reference/watercourse-creation': watercourseCreationReference
}

const withoutBroadHabitat = (feature) => {
  const { broadHabitat: _broad, ...values } = createdAreaValues(feature)
  return values
}

const KINDS = {
  habitat: {
    type: 'habitat',
    feature: createdAreaFeature,
    values: createdAreaValues(createdAreaFeature),
    savePath: 'habitats',
    listPath: 'area-post-intervention'
  },
  tree: {
    type: 'tree',
    feature: createdTree,
    values: createdAreaValues(createdTree),
    savePath: 'trees',
    listPath: 'area-post-intervention'
  },
  hedgerow: {
    type: 'hedgerow',
    feature: createdHedgerowFeature,
    values: withoutBroadHabitat(createdHedgerowFeature),
    savePath: 'hedgerows',
    listPath: 'hedgerows-post-intervention'
  },
  watercourse: {
    type: 'watercourse',
    feature: createdWatercourseFeature,
    values: withoutBroadHabitat(createdWatercourseFeature),
    savePath: 'watercourses',
    listPath: 'watercourses-post-intervention'
  }
}

function mockCreated({ type, feature }, comment = SAVED_COMMENT) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    const referencePath = Object.keys(REFERENCES).find((path) =>
      url.endsWith(path)
    )
    if (referencePath) {
      return Promise.resolve({
        res: { statusCode: 200 },
        payload: REFERENCES[referencePath]
      })
    }
    if (url.includes(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({
        payload: { type, feature: { ...structuredClone(feature), comment } }
      })
    }
    if (isProjectUrl(url)) {
      return Promise.resolve(projectPayload)
    }
    throw new Error(`Unexpected URL ${url}`)
  })
}

function sentPayload() {
  const [, options] = vi.mocked(wreck.put).mock.calls[0]
  return JSON.parse(options.payload)
}

beforeEach(() => {
  _resetCreatedAreaReferenceCache()
  vi.mocked(wreck.put).mockResolvedValue({
    res: { statusCode: 200 },
    payload: {}
  })
})

describe.each(Object.keys(KINDS))('a Created %s', (kindName) => {
  const kind = KINDS[kindName]
  const post = (overrides = {}) => {
    const h = createMockH()
    // A refused save sets the status on the shown page.
    h.view.mockReturnValue({ code: vi.fn() })
    return postController
      .handler(
        { payload: { projectId, featureId, ...kind.values, ...overrides } },
        h
      )
      .then(() => h)
  }

  beforeEach(() => mockCreated(kind))

  test('shows the box filled from the saved comment, keeping its line breaks', async () => {
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    expect(h.view).toHaveBeenCalledWith(
      EDIT_TEMPLATE,
      expect.objectContaining({
        showCommentRow: true,
        commentHint: CREATED_SUPPORTING_INFORMATION_HINT,
        commentInput: { id: 'comment', value: SAVED_COMMENT, error: undefined }
      })
    )
  })

  test('shows an empty box when no comment is saved', async () => {
    mockCreated(kind, null)
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    expect(h.view.mock.calls[0][1].commentInput.value).toBe('')
  })

  test('saves the comment trimmed, with line breaks as LF', async () => {
    const h = await post({ comment: '  First line\r\nSecond line\r\n\r\n  ' })
    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(
        `/post-intervention/${kind.savePath}/${featureId}`
      ),
      expect.anything()
    )
    expect(sentPayload().comment).toBe('First line\nSecond line')
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/${kind.listPath}`
    )
  })

  test.each(['', '  \r\n\t '])(
    'sends a blank or whitespace-only comment as no value: %j',
    async (comment) => {
      await post({ comment })
      expect(sentPayload().comment).toBeNull()
    }
  )

  test('sends no comment, keeping the saved one, when the form has none', async () => {
    await post()
    expect(sentPayload()).not.toHaveProperty('comment')
  })

  test(`saves a comment of exactly ${MAX_COMMENT_LENGTH} characters`, async () => {
    await post({ comment: 'a'.repeat(MAX_COMMENT_LENGTH) })
    expect(sentPayload().comment).toHaveLength(MAX_COMMENT_LENGTH)
  })

  test('refuses a comment that is too long, saving nothing and keeping what was typed', async () => {
    const h = await post({ ref: 'Typed reference', comment: OVER_LIMIT })
    expect(wreck.put).not.toHaveBeenCalled()
    const vm = h.view.mock.calls[0][1]
    expect(vm.pageTitle).toMatch(/^Error: /)
    expect(vm.errorList).toEqual([
      { text: COMMENT_TOO_LONG_ERROR.summary, href: '#comment' }
    ])
    expect(vm.commentInput).toEqual({
      id: 'comment',
      value: OVER_LIMIT,
      error: { text: COMMENT_TOO_LONG_ERROR.inline }
    })
    expect(vm.values.ref).toBe('Typed reference')
  })

  test('refuses a comment holding characters that are not UTF-8', async () => {
    const h = await post({ comment: 'note �' })
    expect(wreck.put).not.toHaveBeenCalled()
    expect(h.view.mock.calls[0][1].errorList).toEqual([
      { text: COMMENT_INVALID_CHARACTERS_ERROR.summary, href: '#comment' }
    ])
  })

  test('shows both comment errors, invalid characters first, after any other field’s', async () => {
    const h = await post({ ref: '   ', comment: `�${OVER_LIMIT}` })
    expect(wreck.put).not.toHaveBeenCalled()
    const vm = h.view.mock.calls[0][1]
    expect(vm.errorList.map((error) => error.href)).toEqual([
      '#ref',
      '#comment',
      '#comment'
    ])
    expect(vm.errorList.slice(1).map((error) => error.text)).toEqual([
      COMMENT_INVALID_CHARACTERS_ERROR.summary,
      COMMENT_TOO_LONG_ERROR.summary
    ])
    expect(vm.commentInput.error.html).toBe(
      `${COMMENT_INVALID_CHARACTERS_ERROR.inline}<br>${COMMENT_TOO_LONG_ERROR.inline}`
    )
  })

  test('keeps the typed comment when the backend refuses the save', async () => {
    const stored = Boom.badData('stored value')
    stored.data = {
      res: { statusCode: 422 },
      payload: {
        statusCode: 422,
        error: 'Unprocessable Entity',
        message:
          'This habitat holds a value saved before the service checked text lengths and lists (strategicSignificance). Upload the file again, with the value corrected, to update it.',
        code: 'STORED_VALUE_NOT_ALLOWED'
      }
    }
    vi.mocked(wreck.put).mockRejectedValue(stored)
    const h = await post({ comment: 'Typed note' })
    expect(h.view.mock.calls[0][1].commentInput.value).toBe('Typed note')
  })
})

describe('the rendered Created edit page', () => {
  let server
  const auth = {
    strategy: 'session',
    credentials: {
      sub: 'test-user',
      email: 'test@example.com',
      roles: ['aaa-bbb:bng completer:3']
    }
  }

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => server.stop({ timeout: 0 }))
  beforeEach(() => mockCreated(KINDS.hedgerow))

  test('has the labelled box with its hint below the units and above Save', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`,
      auth
    })
    expect(response.statusCode).toBe(200)
    const $ = load(response.payload)
    expect($('label[for="comment"]').text().trim()).toBe(
      'Supporting information'
    )
    expect($('#comment-hint').text().trim()).toBe(
      'Add any information that will help support your submission.'
    )
    expect($('textarea#comment').val()).toBe(SAVED_COMMENT)
    expect($('textarea#comment').attr('rows')).toBe('5')
    expect($('.govuk-character-count')).toHaveLength(0)
    const order = $('.app-pi-edit-units, textarea#comment, .govuk-button-group')
      .toArray()
      .map((element) => $(element).attr('id') ?? element.attribs.class)
    expect(order).toEqual([
      expect.stringContaining('app-pi-edit-units'),
      'comment',
      'govuk-button-group'
    ])
  })

  test('links the error summary to the box', async () => {
    const { token: crumb, cookie } = await primeCrumb(server)
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      headers: { cookie },
      payload: {
        projectId,
        featureId,
        ...KINDS.hedgerow.values,
        comment: OVER_LIMIT,
        crumb
      }
    })
    expect(response.payload).toContain(
      `<a href="#comment">${COMMENT_TOO_LONG_ERROR.summary}</a>`
    )
    expect(response.payload).toContain(`>${OVER_LIMIT}</textarea>`)
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test('refuses a save with a comment but without a CSRF token', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      payload: {
        projectId,
        featureId,
        ...KINDS.hedgerow.values,
        comment: 'A note'
      }
    })
    expect(response.statusCode).toBe(403)
    expect(wreck.put).not.toHaveBeenCalled()
  })
})
