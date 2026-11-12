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

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

// A Created individual tree is edited as a Created area habitat is, but stays
// a tree.

// A Medium urban tree newly planted, standing for 2 trees.
const createdTree = {
  featureId,
  ref: 'T026',
  retentionCategory: 'Created',
  count: 2,
  sizeSquareMetres: 326,
  units: 0.2,
  status: 'Complete',
  baseline: {},
  proposed: {
    broadType: 'Individual trees',
    type: 'Urban tree',
    treeSize: 'Medium',
    condition: 'Poor',
    strategicSignificance: 'Low',
    strategicSignificanceCategory: 'Low',
    advanceYears: 0,
    delayYears: 0
  }
}

const treeCreationReference = {
  habitatTypes: ['Rural tree', 'Urban tree'].map((name) => ({
    name,
    broad: 'Individual trees',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    difficulty: 'Low',
    difficultyMultiplier: 1,
    conditions: [
      { condition: 'Moderate', score: 2, years: 27 },
      { condition: 'Poor', score: 1, years: 10 }
    ]
  })),
  strategicSignificance: [
    { value: 'High', score: 1.15 },
    { value: 'Low', score: 1 }
  ],
  timeMultipliers: { 0: 1, 10: 0.7, 27: 0.382 }
}

function mockTree(feature = createdTree) {
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
      return Promise.resolve(projectPayload)
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
