import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

// BMD-1187: a Retained habitat's page shows its baseline habitat's comment,
// read-only, as "Supporting information" — or "No data" when none is saved.
// The backend resolves which baseline habitat the row is joined to and sends
// its comment with the habitat as `baselineComment`, for a Retained habitat
// only; that join is tested there (retained-baseline-comment.test.js).

const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const featureId = 'aa0e8400-e29b-41d4-a716-446655440001'
const baselineFeatureId = 'aa0e8400-e29b-41d4-a716-446655440002'
const pageUrl = `/post-intervention-habitat-details?featureId=${featureId}&projectId=${projectId}`

const MAX_REF_LENGTH = 99
const COMMENT = 'Existing woodland on the eastern field boundary.'
const NO_DATA = 'No data'

// Each Retained feature type and the baseline layer the project lists its
// parcel in, for the "View baseline details" link. A tree and a vertical area
// habitat are area habitats on this page.
const LAYERS = {
  habitat: 'habitats',
  tree: 'trees',
  verticalHabitat: 'verticalHabitats',
  hedgerow: 'hedgerows',
  watercourse: 'watercourses'
}

function retainedFeature(overrides = {}) {
  return {
    featureId,
    ref: 'R1',
    sizeSquareMetres: 10_000,
    sizeMetres: 1000,
    units: 4,
    retentionCategory: 'Retained',
    proposed: { type: 'Modified grassland' },
    ...overrides
  }
}

/**
 * @param {{ type?: string, feature?: object, baselineComment?: string|null, sendsBaselineComment?: boolean, project?: Promise<object> }} options
 *   `baselineComment` is what the feature endpoint sends with the habitat, and
 *   `sendsBaselineComment: false` sends none, as for a habitat that is not
 *   Retained. `project` replaces the project response, as a failed fetch.
 */
function mockBackend({
  type = 'habitat',
  feature = retainedFeature(),
  baselineComment = COMMENT,
  sendsBaselineComment = true,
  project
} = {}) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.endsWith(`/post-intervention/features/${featureId}`)) {
      const payload = { type, feature }
      if (sendsBaselineComment) {
        payload.baselineComment = baselineComment
      }
      return Promise.resolve({ payload })
    }
    if (url.endsWith(`/projects/${projectId}`)) {
      return (
        project ??
        Promise.resolve({
          payload: {
            project: {
              name: 'Meadow',
              baseline: {
                [LAYERS[type]]: [{ featureId: baselineFeatureId, ref: 'R1' }]
              }
            }
          }
        })
      )
    }
    return Promise.reject(new Error(`Unexpected URL ${url}`))
  })
}

/**
 * The text shown under the "Supporting information" heading, or null when the
 * page has no such section.
 *
 * @param {string} html
 * @returns {string|null}
 */
function supportingInformation(html) {
  const match =
    /Supporting information<\/h3>\s*<p class="govuk-body app-stacked-fields__value--multiline">([^<]*)<\/p>/.exec(
      html
    )
  return match ? match[1] : null
}

describe('#postInterventionHabitatDetails — Retained supporting information (BMD-1187)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  function getPage() {
    return server.inject({ method: 'GET', url: pageUrl, auth: authedAuth })
  }

  describe('AC1: the baseline habitat has a saved comment', () => {
    test.each(Object.keys(LAYERS))(
      'shows a retained %s’s baseline comment',
      async (type) => {
        mockBackend({ type })

        const { statusCode, result } = await getPage()

        expect(statusCode).toBe(statusCodes.ok)
        expect(supportingInformation(result)).toBe(COMMENT)
      }
    )

    test('shows the baseline comment, not the comment a template upload stored on the Retained row', async () => {
      mockBackend({
        feature: retainedFeature({ comment: 'Imported with the row' })
      })

      const { result } = await getPage()

      expect(supportingInformation(result)).toBe(COMMENT)
    })

    test('shows it read-only: no text box and nothing submitted', async () => {
      mockBackend()

      const { result } = await getPage()

      expect(result).not.toContain('<textarea')
      expect(result).not.toContain('name="comment"')
    })

    test('keeps the line breaks it was saved with', async () => {
      const comment = 'First line.\nSecond line.\n\nAfter a blank line.'
      mockBackend({ baselineComment: comment })

      const { result } = await getPage()

      expect(supportingInformation(result)).toBe(comment)
    })

    test('shows a long comment in full', async () => {
      const comment = `${'word '.repeat(198)}end`
      mockBackend({ baselineComment: comment })

      const { result } = await getPage()

      expect(supportingInformation(result)).toBe(comment)
    })

    test('shows markup in a comment as text', async () => {
      mockBackend({ baselineComment: '<b>bold</b> & more' })

      const { result } = await getPage()

      expect(supportingInformation(result)).toBe(
        '&lt;b&gt;bold&lt;/b&gt; &amp; more'
      )
    })

    test('sits below Strategic significance and above View baseline details', async () => {
      mockBackend()

      const { result } = await getPage()

      const significance = result.indexOf('Strategic significance')
      const section = result.indexOf('Supporting information')
      const baselineLink = result.indexOf('View baseline details')
      expect(significance).toBeGreaterThan(-1)
      expect(section).toBeGreaterThan(significance)
      expect(baselineLink).toBeGreaterThan(section)
    })

    test('keeps the reference input, Save and Cancel', async () => {
      mockBackend()

      const { result } = await getPage()

      expect(result).toMatch(/<input[^>]*id="habitatRef"/)
      expect(result).toContain('Save')
      expect(result).toContain(
        `href="/projects/${projectId}/area-post-intervention">Cancel`
      )
    })
  })

  describe('AC2: the baseline habitat has no saved comment', () => {
    test.each(Object.keys(LAYERS))(
      'shows "No data" for a retained %s',
      async (type) => {
        mockBackend({ type, baselineComment: null })

        const { statusCode, result } = await getPage()

        expect(statusCode).toBe(statusCodes.ok)
        expect(supportingInformation(result)).toBe(NO_DATA)
      }
    )

    test.each([
      ['a blank comment', ''],
      ['a whitespace-only comment', '  \n ']
    ])('shows "No data" for %s', async (_, baselineComment) => {
      mockBackend({ baselineComment })

      const { result } = await getPage()

      expect(supportingInformation(result)).toBe(NO_DATA)
    })

    test('leaves the habitat’s units as they are', async () => {
      mockBackend({ baselineComment: null })

      const { result } = await getPage()

      expect(result).toMatch(/Habitat units delivered[\s\S]*4\.00/)
    })
  })

  describe('when the project cannot be fetched', () => {
    test('still shows the comment, which comes with the habitat', async () => {
      mockBackend({ project: Promise.reject(new Error('backend down')) })

      const { statusCode, result } = await getPage()

      expect(statusCode).toBe(statusCodes.ok)
      expect(supportingInformation(result)).toBe(COMMENT)
      expect(result).not.toContain('View baseline details')
    })
  })

  test('shows no section when the backend sends no baseline comment', async () => {
    mockBackend({ sendsBaselineComment: false })

    const { statusCode, result } = await getPage()

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toContain('Supporting information')
  })

  test.each(['Enhanced', 'Lost'])(
    'shows no supporting information on an %s habitat’s page',
    async (retentionCategory) => {
      mockBackend({
        feature: retainedFeature({ retentionCategory }),
        sendsBaselineComment: false
      })

      const { statusCode, result } = await getPage()

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('Supporting information')
    }
  )

  test('keeps the comment when a reference save is refused', async () => {
    mockBackend()
    const { token, cookie } = await primeCrumb(server)

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth: authedAuth,
      headers: { cookie },
      payload: {
        projectId,
        featureId,
        habitatRef: 'x'.repeat(MAX_REF_LENGTH + 1),
        crumb: token
      }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(supportingInformation(result)).toBe(COMMENT)
  })
})
