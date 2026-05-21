import Boom from '@hapi/boom'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const authCredentials = {
  sub: 'test-user',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:1']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const habitatId = 'aa0e8400-e29b-41d4-a716-446655440001'
const url = `/baseline-habitat-details?habitatId=${habitatId}&projectId=${projectId}`

const mockHabitat = {
  featureId: habitatId,
  ref: '12',
  // extract-baseline.js stores type as the short habitat-type name only;
  // the controller is responsible for reconstructing the "Broad - Type"
  // lookup key when calling the backend conditions endpoint.
  type: 'Modified grassland',
  broadType: 'Grassland',
  distinctiveness: 'Low',
  distinctivenessScore: 2,
  condition: 'Good',
  sizeSquareMetres: 25000
}

const mockProject = { project: { name: 'Greenfield Meadow Restoration' } }
const mockBroadHabitats = ['Cropland', 'Grassland', 'Urban']
const mockHabitatTypes = ['Bracken', 'Modified grassland']
const mockConditions = [
  { condition: 'Good', score: 3 },
  { condition: 'Fairly Good', score: 2.5 },
  { condition: 'Moderate', score: 2 },
  { condition: 'Fairly Poor', score: 1.5 },
  { condition: 'Poor', score: 1 }
]
const mockTradingRules = {
  'V.High': 'Same habitat required - bespoke compensation option',
  High: 'Same habitat required =',
  Medium: 'Same broad habitat or a higher distinctiveness habitat required (≥)',
  Low: 'Same distinctiveness or better habitat required ≥',
  'V.Low': 'Compensation Not Required'
}

function routeWreck(suffix) {
  if (suffix.endsWith(`/projects/${projectId}/habitats/${habitatId}`)) {
    return { res: { statusCode: 200 }, payload: mockHabitat }
  }
  if (suffix.endsWith(`/projects/${projectId}`)) {
    return { res: { statusCode: 200 }, payload: mockProject }
  }
  if (suffix.endsWith('/reference/broad-habitats')) {
    return { res: { statusCode: 200 }, payload: mockBroadHabitats }
  }
  if (suffix.includes('/reference/habitat-types')) {
    return { res: { statusCode: 200 }, payload: mockHabitatTypes }
  }
  if (suffix.includes('/reference/conditions')) {
    return { res: { statusCode: 200 }, payload: mockConditions }
  }
  if (suffix.endsWith('/reference/trading-rules')) {
    return { res: { statusCode: 200 }, payload: mockTradingRules }
  }
  return { res: { statusCode: 404 }, payload: null }
}

describe('#baselineHabitatDetails - GET', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockImplementation((u) =>
      Promise.resolve(routeWreck(u))
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Renders the page heading with the habitat reference', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Habitat 12')
  })

  test('Renders the project name caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Greenfield Meadow Restoration')
  })

  test('Renders the Baseline Details section heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Baseline Details')
  })

  test('Renders area in hectares (2.5 from 25,000 m²)', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('2.5')
  })

  test('Renders distinctiveness as "band (score)"', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Low (2)')
  })

  test('Renders fixed strategic significance Low (1)', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Low (1)')
  })

  test('Renders the trading rule text for the habitat distinctiveness', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Same distinctiveness or better habitat required')
  })

  test('Renders habitat units to 2 decimal places (2.5 × 2 × 3 = 15.00)', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('15.00')
  })

  test('Renders all three select dropdowns', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('id="broadHabitat"')
    expect(result).toContain('id="habitatType"')
    expect(result).toContain('id="condition"')
  })

  test('Renders Save button and Cancel link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Save')
    expect(result).toContain(
      `href="/projects/${projectId}/habitats?tab=area#habitat-${habitatId}"`
    )
  })

  test('Renders Back link to Area tab of Habitat List', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain(`href="/projects/${projectId}/habitats?tab=area"`)
  })

  test('Calls the conditions endpoint with the combined "Broad - Type" key', async () => {
    await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    const conditionCall = vi
      .mocked(wreck.get)
      .mock.calls.find(([u]) => u.includes('/reference/conditions'))
    expect(conditionCall).toBeDefined()
    expect(conditionCall[0]).toContain(
      `habitatType=${encodeURIComponent('Grassland - Modified grassland')}`
    )
  })

  test('Returns 404 when backend reports habitat not found', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.includes(`/habitats/${habitatId}`)) {
        return Promise.reject(Boom.notFound('not found'))
      }
      return Promise.resolve(routeWreck(u))
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('Re-throws non-404 errors from the habitat fetch rather than masking as 404', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.includes(`/habitats/${habitatId}`)) {
        return Promise.reject(Boom.badGateway('upstream broken'))
      }
      return Promise.resolve(routeWreck(u))
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('Falls back to "Project" caption when the project fetch fails', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith(`/projects/${projectId}`)) {
        return Promise.reject(new Error('boom'))
      }
      return Promise.resolve(routeWreck(u))
    })

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Project')
  })

  test('Skips reference lookups when the habitat has no broadType / type', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith(`/projects/${projectId}/habitats/${habitatId}`)) {
        return Promise.resolve({
          res: { statusCode: 200 },
          payload: {
            featureId: habitatId,
            ref: '99',
            type: null,
            broadType: null,
            distinctiveness: null,
            distinctivenessScore: null,
            condition: null,
            sizeSquareMetres: null
          }
        })
      }
      return Promise.resolve(routeWreck(u))
    })

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Habitat 99')
    // distinctiveness display should be blank when both pieces are absent
    expect(result).not.toContain('Low (2)')

    const calls = vi.mocked(wreck.get).mock.calls.map(([u]) => u)
    expect(calls.some((u) => u.includes('/reference/habitat-types'))).toBe(
      false
    )
    expect(calls.some((u) => u.includes('/reference/conditions'))).toBe(false)
  })
})

describe('#baselineHabitatDetails - validation', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Rejects missing habitatId', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/baseline-habitat-details?projectId=${projectId}`,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Rejects non-UUID habitatId', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/baseline-habitat-details?habitatId=not-a-uuid&projectId=${projectId}`,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badRequest)
  })
})

describe('#baselineHabitatDetails - authentication', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Redirects unauthenticated users', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url
    })
    expect(statusCode).toBe(302)
  })

  test('Redirects users without bng completer role', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url,
      auth: {
        strategy: 'session',
        credentials: {
          sub: 'test-user',
          email: 'test@example.com',
          roles: ['aaa-bbb:other role:1']
        }
      }
    })
    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/auth/forbidden')
  })
})
