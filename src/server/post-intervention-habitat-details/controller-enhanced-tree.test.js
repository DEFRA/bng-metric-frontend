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
  enhancedTreeReference,
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

// An Enhanced individual tree is edited on the Created edit page, but it
// enhances its condition only: it keeps its baseline tree's setting, and is
// offered only the target conditions better than its baseline one.

// A Medium urban tree in Moderate condition, kept and enhanced to Good,
// standing for 2 trees.
const enhancedTree = {
  featureId,
  ref: 'T006',
  retentionCategory: 'Enhanced',
  count: 2,
  sizeSquareMetres: 326,
  units: 0.2,
  status: 'Complete',
  baseline: {
    broadType: 'Individual trees',
    type: 'Urban tree',
    treeSize: 'Medium',
    condition: 'Moderate'
  },
  proposed: {
    broadType: 'Individual trees',
    type: 'Urban tree',
    treeSize: 'Medium',
    condition: 'Good',
    strategicSignificance: 'Low',
    strategicSignificanceCategory: 'Low',
    advanceYears: 0,
    delayYears: 0
  }
}

const enhancements = {
  Good: [],
  'Fairly Good': [{ condition: 'Good', score: 3, years: 8 }],
  Moderate: [
    { condition: 'Good', score: 3, years: 16 },
    { condition: 'Fairly Good', score: 2.5, years: 8 }
  ],
  Poor: [
    { condition: 'Good', score: 3, years: '30+' },
    { condition: 'Moderate', score: 2, years: 16 }
  ]
}

const treeEnhancementReference = {
  habitatTypes: ['Rural tree', 'Urban tree'].map((name) => ({
    name,
    broad: 'Individual trees',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    difficulty: 'Low',
    difficultyMultiplier: 1,
    enhancements
  })),
  strategicSignificance: [
    { value: 'High', score: 1.15 },
    { value: 'Low', score: 1 }
  ],
  timeMultipliers: { 0: 1, 8: 0.75, 16: 0.565 }
}

function mockTree(feature = enhancedTree) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.endsWith('/reference/tree-enhancement')) {
      return Promise.resolve({
        res: { statusCode: 200 },
        payload: treeEnhancementReference
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

const values = createdAreaValues(enhancedTree)
const request = (overrides = {}) => ({
  payload: { projectId, featureId, ...values, ...overrides }
})

const itemValues = (field) =>
  field.items.map((item) => item.value).filter(Boolean)

beforeEach(() => {
  _resetCreatedAreaReferenceCache()
  mockTree()
  vi.mocked(wreck.put).mockResolvedValue({
    res: { statusCode: 200 },
    payload: {}
  })
})

describe('enhancedTreeReference', () => {
  test('offers only the tree’s own setting, with the targets its baseline condition allows', () => {
    const reference = enhancedTreeReference(
      treeEnhancementReference,
      enhancedTree
    )

    expect(reference.habitatTypes.map((t) => t.name)).toEqual(['Urban tree'])
    expect(reference.habitatTypes[0].conditions).toEqual(enhancements.Moderate)
  })

  test('gives the same choices when narrowed again', () => {
    const once = enhancedTreeReference(treeEnhancementReference, enhancedTree)

    expect(enhancedTreeReference(once, enhancedTree)).toEqual(once)
  })

  test('reads a baseline condition stored with its list prefix', () => {
    const reference = enhancedTreeReference(treeEnhancementReference, {
      ...enhancedTree,
      baseline: { ...enhancedTree.baseline, condition: '3. Moderate' }
    })

    expect(reference.habitatTypes[0].conditions).toEqual(enhancements.Moderate)
  })

  test('offers the baseline setting for a tree whose file left its proposed one blank', () => {
    const reference = enhancedTreeReference(treeEnhancementReference, {
      ...enhancedTree,
      proposed: { ...enhancedTree.proposed, type: null }
    })

    expect(reference.habitatTypes.map((t) => t.name)).toEqual(['Urban tree'])
  })

  test('offers no target condition for a tree already in Good condition', () => {
    const reference = enhancedTreeReference(treeEnhancementReference, {
      ...enhancedTree,
      baseline: { ...enhancedTree.baseline, condition: 'Good' }
    })

    expect(reference.habitatTypes[0].conditions).toEqual([])
  })
})

describe('Enhanced tree controller', () => {
  test('loads the edit page with the tree’s saved selections, its broad habitat fixed and its setting the only type', async () => {
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
          condition: 'Good'
        }),
        cancelHref: `/projects/${projectId}/area-post-intervention`
      })
    )
    const vm = h.view.mock.calls[0][1]
    expect(itemValues(vm.fields.habitatType)).toEqual(['Urban tree'])
    expect(itemValues(vm.fields.condition)).toEqual(['Good', 'Fairly Good'])
  })

  test('shows the enhancement time to target from the baseline condition', async () => {
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    const vm = h.view.mock.calls[0][1]
    expect(vm.standardTimeToTargetDisplay).toBe('Moderate to Good - 16 years')
    expect(vm.fields.advanceYears.label).toBe(
      'Habitat enhanced in advance (years)'
    )
    expect(vm.fields.delayYears.label).toBe(
      'Delay in starting habitat enhancement (years)'
    )
  })

  test('saves the tree to the trees endpoint and redirects to the area list', async () => {
    const h = createMockH()
    await postController.handler(
      request({ condition: 'Fairly Good', strategicSignificance: 'High' }),
      h
    )

    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(
        `/projects/${projectId}/post-intervention/trees/${featureId}`
      ),
      expect.objectContaining({
        payload: JSON.stringify({
          ref: 'T006',
          broadType: 'Individual trees',
          habitatType: 'Urban tree',
          condition: 'Fairly Good',
          strategicSignificance: 'High',
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
    ['its baseline condition', 'Moderate'],
    ['a worse one', 'Poor']
  ])(
    'refuses %s as the target condition without saving',
    async (_label, condition) => {
      const h = createMockH()
      await postController.handler(request({ condition }), h)

      expect(wreck.put).not.toHaveBeenCalled()
      const vm = h.view.mock.calls[0][1]
      expect(vm.errors.condition.summary).toBe(
        "Choose a target condition better than the tree's baseline condition"
      )
    }
  )

  test('refuses the other setting without saving', async () => {
    const h = createMockH()
    await postController.handler(request({ habitatType: 'Rural tree' }), h)

    expect(wreck.put).not.toHaveBeenCalled()
    const vm = h.view.mock.calls[0][1]
    expect(vm.errors.habitatType.summary).toBe(
      'Choose Urban tree or Rural tree'
    )
  })
})

describe('Enhanced tree authenticated form', () => {
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

  const optionsOf = (payload, name) =>
    [
      ...payload
        .slice(payload.indexOf(`name="${name}"`))
        .split('</select>')[0]
        .matchAll(/<option value="([^"]*)"/g)
    ]
      .map(([, value]) => value)
      .filter(Boolean)

  test('renders the broad habitat as text, its setting as the only type, and only better target conditions', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`,
      auth
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain(
      '<input type="hidden" id="broadHabitat" name="broadHabitat" value="Individual trees">'
    )
    expect(optionsOf(response.payload, 'habitatType')).toEqual(['Urban tree'])
    expect(optionsOf(response.payload, 'condition')).toEqual([
      'Good',
      'Fairly Good'
    ])
    expect(response.payload).toContain('Habitat enhanced in advance (years)')
  })

  test('shows the condition error when the backend refuses the enhancement', async () => {
    const refused = Boom.badData('not a valid enhancement')
    refused.data = {
      res: { statusCode: 422 },
      payload: {
        statusCode: 422,
        error: 'Unprocessable Entity',
        message:
          'The proposed habitat is not a valid enhancement of its baseline (rule tree-better-condition)',
        code: 'ENHANCEMENT_NOT_VALID',
        rule: 'tree-better-condition'
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
    expect(response.payload).toContain('href="#condition"')
    expect(response.payload).toContain(
      'Choose a target condition better than the tree&#39;s baseline condition'
    )
    expect(response.payload).toContain(`value="${values.ref}"`)
  })
})
