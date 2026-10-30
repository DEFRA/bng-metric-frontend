// @vitest-environment happy-dom
/* global DOMParser */
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'
import { _resetReferenceCache } from './controller.js'

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

const habitat = {
  featureId,
  ref: 'B-A1',
  type: 'Modified grassland',
  broadType: 'Grassland',
  distinctiveness: 'Low',
  distinctivenessScore: 2,
  condition: 'Good',
  sizeSquareMetres: 25000,
  units: 4
}

function routeWreck(url) {
  const payloads = [
    [
      `/projects/${projectId}/features/${featureId}`,
      { type: 'habitat', feature: habitat }
    ],
    [`/projects/${projectId}`, { project: { name: 'Project 1' } }],
    [
      '/reference/habitat-types-by-broad',
      {
        Grassland: [
          {
            name: 'Modified grassland',
            distinctiveness: 'Low',
            distinctivenessScore: 2
          }
        ]
      }
    ],
    ['/reference/trading-rules', { Low: 'Same distinctiveness or better' }]
  ]
  if (url.includes('/reference/conditions')) {
    return {
      res: { statusCode: 200 },
      payload: [{ condition: 'Good', score: 3 }]
    }
  }
  const match = payloads.find(([suffix]) => url.endsWith(suffix))
  return match
    ? { res: { statusCode: 200 }, payload: match[1] }
    : { res: { statusCode: 404 }, payload: null }
}

describe('Baseline habitat details page accessibility checks', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    _resetReferenceCache()
    vi.mocked(wreck.get).mockImplementation((url) =>
      Promise.resolve(routeWreck(url))
    )
  })

  afterEach(() => {
    vi.mocked(wreck.get).mockReset()
  })

  it('should have no HTML accessibility issues', async () => {
    const { document } = await loadPage({
      requestUrl: `/baseline-habitat-details?featureId=${featureId}&projectId=${projectId}`,
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  it('should have no HTML accessibility issues when the habitat reference is refused', async () => {
    const crumb = await primeCrumb(server)
    const response = await server.inject({
      method: 'POST',
      url: '/baseline-habitat-details',
      payload: {
        projectId,
        featureId,
        habitatRef: ' ',
        broadHabitat: 'Grassland',
        habitatType: 'Modified grassland',
        condition: 'Good',
        crumb: crumb.token
      },
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
