// @vitest-environment happy-dom
/* global DOMParser */
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), put: vi.fn() }
}))

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

// Retained, so the page carries the reference input (BMD-1180).
const FEATURES = {
  habitat: {
    featureId,
    ref: 'A1',
    sizeSquareMetres: 25000,
    units: 4,
    retentionCategory: 'Retained',
    proposed: {
      broadType: 'Grassland',
      type: 'Modified grassland',
      condition: 'Good',
      conditionScore: 3,
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  },
  hedgerow: {
    featureId,
    ref: 'H1',
    sizeMetres: 1000,
    units: 6,
    retentionCategory: 'Retained',
    proposed: {
      type: 'Native hedgerow',
      condition: 'Good',
      conditionScore: 3,
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  },
  watercourse: {
    featureId,
    ref: 'W1',
    sizeMetres: 500,
    units: 3,
    retentionCategory: 'Retained',
    baseline: { type: 'Ditches', condition: 'Good' },
    proposed: {
      type: 'Ditches',
      condition: 'Good',
      conditionScore: 3,
      distinctiveness: 'Medium',
      distinctivenessScore: 4
    }
  }
}

function mockBackend(type) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.endsWith(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({ payload: { type, feature: FEATURES[type] } })
    }
    return Promise.resolve({
      payload: {
        project: {
          name: 'Project 1',
          baseline: { habitats: [{ featureId: baselineFeatureId, ref: 'A1' }] }
        }
      }
    })
  })
}

describe('Post-intervention habitat details page accessibility checks', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.mocked(wreck.get).mockReset()
  })

  it.each(['habitat', 'hedgerow', 'watercourse'])(
    'should have no HTML accessibility issues for a retained %s',
    async (type) => {
      mockBackend(type)
      const { document } = await loadPage({
        requestUrl: `/post-intervention-habitat-details?featureId=${featureId}&projectId=${projectId}`,
        server,
        auth: authedAuth
      })
      assertLayoutLandmarks(document)
      await runAxeChecks(document.documentElement)
    }
  )

  it('should have no HTML accessibility issues when the habitat reference is refused', async () => {
    mockBackend('habitat')
    const crumb = await primeCrumb(server)
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      payload: { projectId, featureId, habitatRef: ' ', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })
    expect(response.statusCode).toBe(400)
    const document = new DOMParser().parseFromString(
      response.result,
      'text/html'
    )
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
