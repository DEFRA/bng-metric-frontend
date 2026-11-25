import Boom from '@hapi/boom'
import { wreck } from '../common/helpers/wreck-client.js'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import {
  createMockH,
  featureId,
  isProjectUrl,
  projectId,
  projectPayload
} from './controller-test-helpers.js'
import {
  createdAreaValues,
  _resetCreatedAreaReferenceCache
} from './created-area-edit.js'
import { getController, postController } from './controller.js'
import {
  createdTree,
  treeCreationReference
} from './created-tree-test-fixtures.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

function mockTree(feature = createdTree, project = projectPayload) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.endsWith('/reference/tree-creation')) {
      return Promise.resolve({
        res: { statusCode: 200 },
        payload: treeCreationReference
      })
    }
    if (url.includes(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({
        payload: { type: 'tree', feature: structuredClone(feature) }
      })
    }
    if (isProjectUrl(url)) {
      return Promise.resolve(project)
    }
    throw new Error(`Unexpected URL ${url}`)
  })
}

const values = createdAreaValues(createdTree)
const request = (overrides = {}) => ({
  payload: { projectId, featureId, ...values, ...overrides }
})

beforeEach(() => {
  _resetCreatedAreaReferenceCache()
  mockTree()
  vi.mocked(wreck.put).mockResolvedValue({
    res: { statusCode: 200 },
    payload: {}
  })
})

describe('Created tree controller', () => {
  test('loads the edit page with the tree’s saved selections and its broad habitat fixed', async () => {
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-created-edit',
      expect.objectContaining({
        fixedBroadHabitat: 'Individual trees',
        showTreeRows: true,
        treeSizeDisplay: 'Medium',
        treeCountDisplay: '2',
        values: expect.objectContaining({
          broadHabitat: 'Individual trees',
          habitatType: 'Urban tree',
          condition: 'Poor'
        }),
        cancelHref: `/projects/${projectId}/area-post-intervention`
      })
    )
  })

  // An Existing tree recorded as its baseline tree lost and a tree Created in
  // Poor condition: its row still carries the baseline tree's Moderate.
  const existingCreatedTree = (proposed = {}) => ({
    ...createdTree,
    properties: { Category: 'Existing' },
    baseline: {
      broadType: 'Individual trees',
      type: 'Urban tree',
      treeSize: 'Medium',
      condition: 'Moderate'
    },
    proposed: { ...createdTree.proposed, advanceYears: 30, ...proposed }
  })

  test('shows an Existing tree Created in a lower condition as a creation, naming no baseline condition', async () => {
    mockTree(existingCreatedTree({ standardTimeToTargetCondition: '10' }))
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    const view = h.view.mock.calls[0][1]
    expect(view.baselineCondition).toBe('')
    expect(view.standardTimeToTargetDisplay).toBe('Poor - 10 years')
  })

  test('names no baseline condition in the time to target it works out with no stored years', async () => {
    mockTree(existingCreatedTree())
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view.mock.calls[0][1].standardTimeToTargetDisplay).toBe(
      'Poor - 10 years'
    )
  })

  test('names no baseline condition in the time to target it works out for a changed condition', async () => {
    mockTree(existingCreatedTree({ standardTimeToTargetCondition: '10' }))
    const h = createMockH()
    // A blank reference shows the page again with the condition chosen.
    await postController.handler(
      request({ ref: ' ', condition: 'Moderate' }),
      h
    )

    expect(h.view.mock.calls[0][1].standardTimeToTargetDisplay).toBe(
      'Moderate - 27 years'
    )
  })

  test('names no baseline condition on the read-only page shown until the backend serves the tree reference', async () => {
    mockTree(existingCreatedTree({ standardTimeToTargetCondition: '10' }))
    const get = vi.mocked(wreck.get).getMockImplementation()
    vi.mocked(wreck.get).mockImplementation((url) =>
      url.endsWith('/reference/tree-creation')
        ? Promise.reject(Boom.notFound())
        : get(url)
    )
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    const view = h.view.mock.calls[0][1]
    expect(view).not.toHaveProperty('formAction')
    expect(view.standardTimeToTargetDisplay).toBe('Poor - 10 years')
  })

  // A Created tree's page links to no baseline tree, even where one shares its
  // ref and matches the baseline its row carries, as the second tree here does.
  describe('no baseline link for a Created tree whose ref baseline trees share', () => {
    const POOR_TREE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    const MODERATE_TREE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    const baselineTree = (featureId, condition) => ({
      featureId,
      ref: 'T026',
      type: 'Urban tree',
      broadType: 'Individual trees',
      condition
    })
    const legacyProject = {
      payload: {
        project: {
          name: 'Test Project',
          baseline: {
            trees: [
              baselineTree(POOR_TREE_ID, 'Poor'),
              baselineTree(MODERATE_TREE_ID, 'Moderate')
            ]
          }
        }
      }
    }
    const unlinked = (view) => {
      expect(view.viewBaselineHref).toBeFalsy()
      expect(JSON.stringify(view)).not.toContain(POOR_TREE_ID)
      expect(JSON.stringify(view)).not.toContain(MODERATE_TREE_ID)
    }

    beforeEach(() => {
      mockTree(
        existingCreatedTree({ standardTimeToTargetCondition: '10' }),
        legacyProject
      )
    })

    test('shows none on the edit page', async () => {
      const h = createMockH()
      await getController.handler({ query: { projectId, featureId } }, h)

      unlinked(h.view.mock.calls[0][1])
    })

    test('shows none when the page is shown again', async () => {
      const h = createMockH()
      await postController.handler(request({ ref: ' ' }), h)

      unlinked(h.view.mock.calls[0][1])
    })

    test('shows none on the read-only page', async () => {
      const get = vi.mocked(wreck.get).getMockImplementation()
      vi.mocked(wreck.get).mockImplementation((url) =>
        url.endsWith('/reference/tree-creation')
          ? Promise.reject(Boom.notFound())
          : get(url)
      )
      const h = createMockH()
      await getController.handler({ query: { projectId, featureId } }, h)

      unlinked(h.view.mock.calls[0][1])
    })
  })

  test('saves the tree to the trees endpoint and redirects to the area list', async () => {
    const h = createMockH()
    await postController.handler(
      request({ habitatType: 'Rural tree', condition: 'Moderate' }),
      h
    )

    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(
        `/projects/${projectId}/post-intervention/trees/${featureId}`
      ),
      expect.objectContaining({
        payload: JSON.stringify({
          ref: 'T026',
          broadType: 'Individual trees',
          habitatType: 'Rural tree',
          condition: 'Moderate',
          strategicSignificance: 'Low',
          advanceYears: '0',
          delayYears: '0'
        })
      })
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/area-post-intervention`
    )
  })

  test.each([
    ['a blank habitat type', { habitatType: '' }],
    ['a habitat type that is not a tree', { habitatType: 'Modified grassland' }]
  ])('refuses %s without saving', async (_label, overrides) => {
    const h = createMockH()
    await postController.handler(request(overrides), h)

    expect(wreck.put).not.toHaveBeenCalled()
    const vm = h.view.mock.calls[0][1]
    expect(vm.errors.habitatType.summary).toBe(
      'Choose Urban tree or Rural tree'
    )
  })

  test('saves the tree as Individual trees whatever broad habitat is posted', async () => {
    const h = createMockH()
    await postController.handler(request({ broadHabitat: 'Grassland' }), h)

    expect(JSON.parse(wreck.put.mock.calls[0][1].payload)).toMatchObject({
      broadType: 'Individual trees',
      habitatType: 'Urban tree'
    })
    expect(h.redirect).toHaveBeenCalled()
  })

  test.each([
    ['blank', null],
    ['another', 'Trees']
  ])(
    'offers Urban tree and Rural tree for a tree stored with %s broad habitat',
    async (_label, broadType) => {
      mockTree({
        ...createdTree,
        proposed: { ...createdTree.proposed, broadType }
      })
      const h = createMockH()
      await getController.handler({ query: { projectId, featureId } }, h)

      const vm = h.view.mock.calls[0][1]
      expect(vm.values.broadHabitat).toBe('Individual trees')
      expect(vm.fields.habitatType.items.map((item) => item.value)).toEqual([
        'Rural tree',
        'Urban tree'
      ])
      expect(vm.distinctivenessDisplay).not.toBe('')
    }
  )
})

// A BNG Service template's Created tree can be planted at another size class
// (BMD-1172); a legacy one's size class is shown, not edited.
describe('Created tree size class', () => {
  const templateProject = {
    payload: {
      project: {
        name: 'Test Project',
        postIntervention: { template: { name: 'bng-service' } }
      }
    }
  }

  async function editPage(project) {
    mockTree(createdTree, project)
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    return h.view.mock.calls[0][1]
  }

  test('offers a template tree the Metric’s size classes, with its planted one chosen', async () => {
    const vm = await editPage(templateProject)

    expect(vm.treeSizeField).toMatchObject({
      id: 'treeSize',
      label: 'Tree size'
    })
    expect(vm.treeSizeField.items.map((item) => item.value)).toEqual([
      'Small',
      'Medium',
      'Large',
      'Very large'
    ])
    expect(vm.treeSizeField.items.find((item) => item.selected)?.value).toBe(
      createdTree.proposed.treeSize
    )
  })

  test('shows a legacy tree’s size class read-only', async () => {
    const vm = await editPage(projectPayload)

    expect(vm.treeSizeField).toBeNull()
    expect(vm.treeSizeDisplay).toBe(createdTree.proposed.treeSize)
  })

  test('saves a new size class with the tree’s other choices', async () => {
    mockTree(createdTree, templateProject)
    const h = createMockH()
    await postController.handler(request({ treeSize: 'Large' }), h)

    expect(JSON.parse(wreck.put.mock.calls[0][1].payload)).toMatchObject({
      ref: 'T026',
      habitatType: 'Urban tree',
      treeSize: 'Large'
    })
    expect(h.redirect).toHaveBeenCalled()
  })

  test('leaves a blank size class out of the save', async () => {
    mockTree(createdTree, templateProject)
    const h = createMockH()
    await postController.handler(request({ treeSize: '' }), h)

    expect(JSON.parse(wreck.put.mock.calls[0][1].payload)).not.toHaveProperty(
      'treeSize'
    )
  })

  test('keeps the size class chosen when the page is shown again with an error', async () => {
    mockTree(createdTree, templateProject)
    const h = createMockH()
    await postController.handler(
      request({ treeSize: 'Very large', habitatType: '' }),
      h
    )

    expect(wreck.put).not.toHaveBeenCalled()
    const vm = h.view.mock.calls[0][1]
    expect(vm.treeSizeField.items.find((item) => item.selected)?.value).toBe(
      'Very large'
    )
  })

  test('refuses a size class the Metric does not have', async () => {
    mockTree(createdTree, templateProject)

    await expect(
      postController.handler(request({ treeSize: 'Huge' }), createMockH())
    ).rejects.toMatchObject({ output: { statusCode: 400 } })
    expect(wreck.put).not.toHaveBeenCalled()
  })
})

describe('Created tree authenticated form', () => {
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

  test('renders the broad habitat as text and offers only Urban tree and Rural tree', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`,
      auth
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain(
      '<input type="hidden" id="broadHabitat" name="broadHabitat" value="Individual trees">'
    )
    expect(response.payload).not.toMatch(/<select[^>]*name="broadHabitat"/)
    const habitatTypes = [
      ...response.payload
        .slice(response.payload.indexOf('name="habitatType"'))
        .split('</select>')[0]
        .matchAll(/<option value="([^"]*)"/g)
    ].map(([, value]) => value)
    expect(habitatTypes).toEqual(['Rural tree', 'Urban tree'])
    expect(response.payload).toContain('Number of trees')
  })

  test('shows the page again, in the error summary, when the backend refuses a tree that would no longer be a tree', async () => {
    const refused = Boom.badRequest('not a tree')
    refused.data = {
      res: { statusCode: 400 },
      payload: {
        statusCode: 400,
        error: 'Bad Request',
        message:
          'A tree stays an Urban tree or a Rural tree in Individual trees',
        code: 'FEATURE_NOT_EDITABLE'
      }
    }
    vi.mocked(wreck.put).mockRejectedValue(refused)
    const { token, cookie } = await primeCrumb(server)

    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      headers: { cookie },
      payload: { ...request().payload, crumb: token }
    })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toMatch(/<title>\s*Error: /)
    expect(response.payload).toContain('govuk-error-summary')
    expect(response.payload).not.toContain('govuk-input--error')
    expect(response.payload).toContain(`value="${values.ref}"`)
  })

  // An Existing tree Created over its baseline tree is held by the backend to
  // the guide's steps for a tree whose condition gets worse.
  test.each([
    [
      'degrade-worse-condition',
      'condition',
      'Choose a target condition lower than the baseline tree&#39;s condition'
    ],
    [
      'degrade-advance-30-plus',
      'advanceYears',
      'Set the years in advance to 30+'
    ]
  ])(
    'shows the field to blame when the backend refuses the edit of an Existing tree Created over its baseline tree (%s)',
    async (rule, field, wording) => {
      const refused = Boom.badData('does not follow the guide')
      refused.data = {
        res: { statusCode: 422 },
        payload: {
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: `The tree is its baseline tree created again, so it must be in a lower condition and created 30+ years in advance, or put back after a delay (rule ${rule})`,
          code: 'TREE_DEGRADE_NOT_VALID',
          rule
        }
      }
      vi.mocked(wreck.put).mockRejectedValue(refused)
      const { token, cookie } = await primeCrumb(server)

      const response = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        auth,
        headers: { cookie },
        payload: { ...request().payload, crumb: token }
      })

      expect(response.statusCode).toBe(422)
      expect(response.payload).toMatch(/<title>\s*Error: /)
      expect(response.payload).toContain(`href="#${field}"`)
      expect(response.payload).toContain(wording)
      expect(response.payload).toContain('Newly Planted')
      expect(response.payload).toContain(`value="${values.ref}"`)
    }
  )
})

describe('Retained tree reference', () => {
  test('saves a new reference through the rename endpoint', async () => {
    mockTree({ ...createdTree, retentionCategory: 'Retained' })
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { type: 'tree', feature: { featureId, ref: 'T026-new' } }
    })
    const h = createMockH()

    await postController.handler(
      { payload: { projectId, featureId, habitatRef: 'T026-new' } },
      h
    )

    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(
        `/projects/${projectId}/post-intervention/features/${featureId}`
      ),
      expect.objectContaining({ payload: JSON.stringify({ ref: 'T026-new' }) })
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/area-post-intervention`
    )
  })
})
