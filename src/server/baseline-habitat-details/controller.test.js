import Boom from '@hapi/boom'

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
  sizeSquareMetres: 25000,
  units: 15
}

const mockProject = { project: { name: 'Greenfield Meadow Restoration' } }
const mockBroadHabitats = ['Cropland', 'Grassland', 'Urban']
const mockHabitatTypesByBroad = {
  Cropland: [
    { name: 'Cereal crops', distinctiveness: 'Low', distinctivenessScore: 2 }
  ],
  Grassland: [
    { name: 'Bracken', distinctiveness: 'Low', distinctivenessScore: 2 },
    {
      name: 'Modified grassland',
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  ],
  Urban: [
    {
      name: 'Developed land; sealed surface',
      distinctiveness: 'V.Low',
      distinctivenessScore: 0
    }
  ]
}
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
    const match = suffix.match(/broad=([^&]+)/)
    const broad = match ? decodeURIComponent(match[1]) : null
    return {
      res: { statusCode: 200 },
      payload: mockHabitatTypesByBroad[broad] ?? []
    }
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

  test('Renders the persisted habitat.units value to 2 decimal places', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('15.00')
  })

  test('Renders an empty habitat units cell when habitat.units is missing', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith(`/projects/${projectId}/habitats/${habitatId}`)) {
        const { units, ...withoutUnits } = mockHabitat
        return Promise.resolve({
          res: { statusCode: 200 },
          payload: withoutUnits
        })
      }
      return Promise.resolve(routeWreck(u))
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    // No "15.00" (would only render if local compute were still in place),
    // and no "0.00" (we deliberately avoid showing a fabricated zero).
    expect(result).not.toContain('15.00')
    expect(result).not.toContain('0.00')
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

  test('Renders habitat-type options with the type name and selects the persisted type', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('[object Object]')
    expect(result).toContain('<option value="Bracken">Bracken</option>')
    expect(result).toContain(
      '<option value="Modified grassland" selected>Modified grassland</option>'
    )
  })

  test('Renders Save button and Cancel link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Save')
    expect(result).toContain(
      `href="/projects/${projectId}/habitat-list#habitat-${habitatId}"`
    )
  })

  test('Renders Back link to the Habitat List page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain(`href="/projects/${projectId}/habitat-list"`)
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

  test('Renders blank distinctiveness when the habitat has no broadType / type', async () => {
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

    // Condition lookup still skipped without a habitat type, but habitat-types
    // are fetched for every broad so the client-side dropdown JS has the data
    // to populate the type dropdown when the user picks a broad.
    const calls = vi.mocked(wreck.get).mock.calls.map(([u]) => u)
    expect(calls.some((u) => u.includes('/reference/conditions'))).toBe(false)
  })

  test('Embeds habitatTypesByBroad data for the client-side dropdown JS', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('id="bhd-reference-data"')
    // Each broad's types should appear in the embedded JSON
    expect(result).toContain('Modified grassland')
    expect(result).toContain('Cereal crops')
    expect(result).toContain('habitatTypesByBroad')
    expect(result).toContain('tradingRulesByBand')
  })

  test('Includes a default "Choose ..." option for each dropdown', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Choose broad habitat')
    expect(result).toContain('Choose habitat type')
    expect(result).toContain('Choose condition')
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

describe('#baselineHabitatDetails - POST', () => {
  let server
  let crumb

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(async () => {
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { ...mockHabitat, habitatUnits: 7.5, status: 'Complete' }
    })
    crumb = await primeCrumb(server)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Saves the dropdown values and redirects to the habitat list', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/baseline-habitat-details',
      payload: {
        projectId,
        featureId: habitatId,
        broadHabitat: 'Grassland',
        habitatType: 'Modified grassland',
        condition: 'Good',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe(
      `/projects/${projectId}/habitat-list#habitat-${habitatId}`
    )
    expect(vi.mocked(wreck.put)).toHaveBeenCalledWith(
      expect.stringContaining(`/projects/${projectId}/habitats/${habitatId}`),
      expect.objectContaining({
        payload: JSON.stringify({
          broadType: 'Grassland',
          habitatType: 'Modified grassland',
          condition: 'Good'
        })
      })
    )
  })

  test('Sends nulls when dropdown values are empty (Incomplete habitat)', async () => {
    await server.inject({
      method: 'POST',
      url: '/baseline-habitat-details',
      payload: {
        projectId,
        featureId: habitatId,
        broadHabitat: '',
        habitatType: '',
        condition: '',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(vi.mocked(wreck.put)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        payload: JSON.stringify({
          broadType: null,
          habitatType: null,
          condition: null
        })
      })
    )
  })

  test('Returns 502 when the backend save fails', async () => {
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 500 },
      payload: { error: 'boom' }
    })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/baseline-habitat-details',
      payload: {
        projectId,
        featureId: habitatId,
        broadHabitat: 'Grassland',
        habitatType: 'Modified grassland',
        condition: 'Good',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('Rejects POST with 403 when crumb is missing', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/baseline-habitat-details',
      payload: {
        projectId,
        featureId: habitatId,
        broadHabitat: 'Grassland'
      },
      auth: authedAuth
    })

    expect(statusCode).toBe(403)
  })
})

describe('#baselineHabitatDetails - conditions proxy', () => {
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

  test('Forwards habitatType to the backend conditions endpoint', async () => {
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/api/reference/conditions?habitatType=Grassland%20-%20Modified%20grassland',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(mockConditions)
    const lastCall = vi
      .mocked(wreck.get)
      .mock.calls.find(([u]) => u.includes('/reference/conditions'))
    expect(lastCall[0]).toContain(
      `habitatType=${encodeURIComponent('Grassland - Modified grassland')}`
    )
  })

  test('Rejects missing habitatType query param with 400', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/api/reference/conditions',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
