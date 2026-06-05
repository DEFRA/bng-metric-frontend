import Boom from '@hapi/boom'

import {
  REQUIRED_ELEMENT_IDS_AREA,
  REQUIRED_ELEMENT_IDS_HEDGEROW
} from '../../client/javascripts/baseline-habitat-details.js'
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { _resetReferenceCache } from './controller.js'

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
const url = `/baseline-habitat-details?featureId=${habitatId}&projectId=${projectId}`

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
  if (suffix.endsWith(`/projects/${projectId}/features/${habitatId}`)) {
    return {
      res: { statusCode: 200 },
      payload: { type: 'habitat', feature: mockHabitat }
    }
  }
  if (suffix.endsWith(`/projects/${projectId}`)) {
    return { res: { statusCode: 200 }, payload: mockProject }
  }
  if (suffix.endsWith('/reference/habitat-types-by-broad')) {
    return { res: { statusCode: 200 }, payload: mockHabitatTypesByBroad }
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
    _resetReferenceCache()
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
      if (u.endsWith(`/projects/${projectId}/features/${habitatId}`)) {
        const { units, ...withoutUnits } = mockHabitat
        return Promise.resolve({
          res: { statusCode: 200 },
          payload: { type: 'habitat', feature: withoutUnits }
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
      `href="/projects/${projectId}/baseline-habitat-list#habitat-${habitatId}"`
    )
  })

  test('Renders Back link to the Habitat List page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain(
      `href="/projects/${projectId}/baseline-habitat-list"`
    )
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
      if (u.includes(`/features/${habitatId}`)) {
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
      if (u.includes(`/features/${habitatId}`)) {
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

  test('Falls back to "Project" caption when payload has no project name', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith(`/projects/${projectId}`)) {
        return Promise.resolve({
          res: { statusCode: 200 },
          payload: { project: {} }
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
    expect(result).toContain('Project')
    expect(result).not.toContain('Greenfield')
  })

  test('Falls back to empty habitat-types when the broad is unknown to the reference data', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith(`/projects/${projectId}/features/${habitatId}`)) {
        return Promise.resolve({
          res: { statusCode: 200 },
          payload: {
            type: 'habitat',
            feature: { ...mockHabitat, broadType: 'Unknown broad' }
          }
        })
      }
      return Promise.resolve(routeWreck(u))
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Falls back to empty trading rule when the band has no entry in the rules map', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith(`/projects/${projectId}/features/${habitatId}`)) {
        return Promise.resolve({
          res: { statusCode: 200 },
          payload: {
            type: 'habitat',
            feature: { ...mockHabitat, distinctiveness: 'NotInRulesMap' }
          }
        })
      }
      return Promise.resolve(routeWreck(u))
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
    // Cell is rendered but empty when the band has no trading-rule entry
    expect(result).toContain('<span id="tradingRuleDisplay"></span>')
  })

  test('Renders blank habitat reference when ref is missing on the document', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith(`/projects/${projectId}/features/${habitatId}`)) {
        const { ref, ...withoutRef } = mockHabitat
        return Promise.resolve({
          res: { statusCode: 200 },
          payload: { type: 'habitat', feature: withoutRef }
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
    expect(result).toContain('Habitat ')
    expect(result).not.toContain('Habitat 12')
  })

  test('Renders blank distinctiveness when the habitat has no broadType / type', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith(`/projects/${projectId}/features/${habitatId}`)) {
        return Promise.resolve({
          res: { statusCode: 200 },
          payload: {
            type: 'habitat',
            feature: {
              featureId: habitatId,
              ref: '99',
              type: null,
              broadType: null,
              distinctiveness: null,
              distinctivenessScore: null,
              condition: null,
              sizeSquareMetres: null
            }
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

  test('Embeds the habitat-types reference data for the client-side dropdown JS', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('id="bhd-reference-data"')
    // Each habitat type should appear in the embedded JSON, with its parent
    // broad annotated on the entry.
    expect(result).toContain('Modified grassland')
    expect(result).toContain('Cereal crops')
    expect(result).toContain('habitatTypes')
    expect(result).toContain('"broad":"Grassland"')
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

  test.each(REQUIRED_ELEMENT_IDS_AREA)(
    'Renders id="%s" so the client JS can find it',
    async (id) => {
      const { result } = await server.inject({
        method: 'GET',
        url,
        auth: authedAuth
      })
      expect(result).toContain(`id="${id}"`)
    }
  )
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

  test('Rejects missing featureId', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/baseline-habitat-details?projectId=${projectId}`,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Rejects non-UUID featureId', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/baseline-habitat-details?featureId=not-a-uuid&projectId=${projectId}`,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badRequest)
  })
})

describe('#baselineHabitatDetails - GET (hedgerow strategy)', () => {
  let server

  const hedgerowId = 'bb0e8400-e29b-41d4-a716-446655440002'
  const hedgerowUrl = `/baseline-habitat-details?featureId=${hedgerowId}&projectId=${projectId}`
  const mockHedgerow = {
    featureId: hedgerowId,
    ref: 'H1',
    type: 'Native hedgerow',
    distinctiveness: 'Low',
    distinctivenessScore: 2,
    condition: 'Good',
    sizeMetres: 1234.567,
    units: 8
  }
  const mockHedgerowTypes = [
    {
      name: 'Native hedgerow',
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  ]
  const mockHedgerowConditions = [
    { condition: 'Good', score: 3 },
    { condition: 'Moderate', score: 2 },
    { condition: 'Poor', score: 1 }
  ]

  function routeHedgerowWreck(suffix) {
    if (suffix.endsWith(`/projects/${projectId}/features/${hedgerowId}`)) {
      return {
        res: { statusCode: 200 },
        payload: { type: 'hedgerow', feature: mockHedgerow }
      }
    }
    if (suffix.endsWith(`/projects/${projectId}`)) {
      return { res: { statusCode: 200 }, payload: mockProject }
    }
    if (suffix.endsWith('/reference/hedgerow-types')) {
      return { res: { statusCode: 200 }, payload: mockHedgerowTypes }
    }
    if (suffix.includes('/reference/conditions')) {
      return { res: { statusCode: 200 }, payload: mockHedgerowConditions }
    }
    if (suffix.endsWith('/reference/trading-rules')) {
      return { res: { statusCode: 200 }, payload: mockTradingRules }
    }
    return { res: { statusCode: 404 }, payload: null }
  }

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    _resetReferenceCache()
    vi.mocked(wreck.get).mockImplementation((u) =>
      Promise.resolve(routeHedgerowWreck(u))
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Renders the page heading with "Hedgerow" + the hedgerow reference', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: hedgerowUrl,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Hedgerow H1')
  })

  test('Renders length in km (not area in hectares) and labels the row "Length (km)"', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: hedgerowUrl,
      auth: authedAuth
    })
    expect(result).toContain('Length (km)')
    expect(result).not.toContain('Area (hectares)')
    expect(result).toContain('1.234567')
  })

  test('Omits the Broad habitat row for hedgerows', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: hedgerowUrl,
      auth: authedAuth
    })
    expect(result).not.toContain('Broad habitat')
    expect(result).not.toContain('id="broadHabitat"')
  })

  test('Loads conditions from the hedgerow reference table (featureType=hedgerow)', async () => {
    await server.inject({
      method: 'GET',
      url: hedgerowUrl,
      auth: authedAuth
    })
    const conditionCall = vi
      .mocked(wreck.get)
      .mock.calls.find(([u]) => u.includes('/reference/conditions'))
    expect(conditionCall).toBeDefined()
    expect(conditionCall[0]).toContain('featureType=hedgerow')
    expect(conditionCall[0]).toContain(
      `habitatType=${encodeURIComponent('Native hedgerow')}`
    )
  })

  test('Back and Cancel links return to the Hedgerows tab of the habitat list', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: hedgerowUrl,
      auth: authedAuth
    })
    expect(result).toContain(
      `href="/projects/${projectId}/baseline-habitat-list#hedgerows"`
    )
  })

  test.each(REQUIRED_ELEMENT_IDS_HEDGEROW)(
    'Renders id="%s" so the client JS can find it',
    async (id) => {
      const { result } = await server.inject({
        method: 'GET',
        url: hedgerowUrl,
        auth: authedAuth
      })
      expect(result).toContain(`id="${id}"`)
    }
  )
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
    _resetReferenceCache()
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        type: 'habitat',
        feature: { ...mockHabitat, units: 7.5, status: 'Complete' }
      }
    })
    crumb = await primeCrumb(server)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Saves area habitat edits via the unified features endpoint and redirects to the row anchor', async () => {
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
      `/projects/${projectId}/baseline-habitat-list#habitat-${habitatId}`
    )
    expect(vi.mocked(wreck.put)).toHaveBeenCalledWith(
      expect.stringContaining(`/projects/${projectId}/features/${habitatId}`),
      expect.objectContaining({
        payload: JSON.stringify({
          broadType: 'Grassland',
          habitatType: 'Modified grassland',
          condition: 'Good'
        })
      })
    )
  })

  test('Redirects to the Hedgerows tab when the backend reports a hedgerow edit', async () => {
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        type: 'hedgerow',
        feature: {
          featureId: habitatId,
          ref: 'H1',
          type: 'Native hedgerow',
          condition: 'Good',
          status: 'Incomplete',
          units: 0
        }
      }
    })

    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/baseline-habitat-details',
      payload: {
        projectId,
        featureId: habitatId,
        habitatType: 'Native hedgerow',
        condition: 'Good',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe(
      `/projects/${projectId}/baseline-habitat-list#hedgerows`
    )
  })

  test('Redirects to the Watercourses tab when the backend reports a watercourse edit', async () => {
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        type: 'watercourse',
        feature: {
          featureId: habitatId,
          ref: 'WC1',
          type: 'Ditch',
          condition: 'Good',
          status: 'Incomplete',
          units: 0
        }
      }
    })

    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/baseline-habitat-details',
      payload: {
        projectId,
        featureId: habitatId,
        habitatType: 'Ditch',
        condition: 'Good',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe(
      `/projects/${projectId}/baseline-habitat-list#watercourses`
    )
  })

  test('Falls back to the area row anchor when the backend response has no type', async () => {
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { feature: { ...mockHabitat, units: 7.5 } }
    })

    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/baseline-habitat-details',
      payload: {
        projectId,
        featureId: habitatId,
        broadHabitat: 'Grassland',
        habitatType: 'Lowland meadows',
        condition: 'Good',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe(
      `/projects/${projectId}/baseline-habitat-list#habitat-${habitatId}`
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
    vi.mocked(wreck.put).mockRejectedValue({
      isBoom: true,
      output: { statusCode: 500 },
      data: { payload: { error: 'boom' } }
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

  test('Returns 409 (not 5xx) when the backend reports a concurrent-edit conflict', async () => {
    vi.mocked(wreck.put).mockRejectedValue({
      isBoom: true,
      output: { statusCode: statusCodes.conflict },
      data: {
        payload: { message: 'Another edit for this project is in progress' }
      }
    })

    const { statusCode, result } = await server.inject({
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

    expect(statusCode).toBe(statusCodes.conflict)
    expect(result).toContain('Another user is editing this')
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
    _resetReferenceCache()
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

  test('Returns 502 when the backend conditions fetch returns an error status', async () => {
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.includes('/reference/conditions')) {
        return Promise.resolve({
          res: { statusCode: 500 },
          payload: { error: 'upstream broken' }
        })
      }
      return Promise.resolve(routeWreck(u))
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/api/reference/conditions?habitatType=Grassland%20-%20Modified%20grassland',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })
})

describe('#baselineHabitatDetails - static reference cache', () => {
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
    vi.mocked(wreck.get).mockImplementation((u) =>
      Promise.resolve(routeWreck(u))
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Calls /reference/habitat-types-by-broad once across multiple page loads', async () => {
    await server.inject({ method: 'GET', url, auth: authedAuth })
    await server.inject({ method: 'GET', url, auth: authedAuth })
    await server.inject({ method: 'GET', url, auth: authedAuth })

    const calls = vi
      .mocked(wreck.get)
      .mock.calls.map(([u]) => u)
      .filter((u) => u.endsWith('/reference/habitat-types-by-broad'))
    expect(calls).toHaveLength(1)
  })

  test('Calls /reference/trading-rules once across multiple page loads', async () => {
    await server.inject({ method: 'GET', url, auth: authedAuth })
    await server.inject({ method: 'GET', url, auth: authedAuth })

    const calls = vi
      .mocked(wreck.get)
      .mock.calls.map(([u]) => u)
      .filter((u) => u.endsWith('/reference/trading-rules'))
    expect(calls).toHaveLength(1)
  })

  test('Re-fetches after the cache is reset', async () => {
    await server.inject({ method: 'GET', url, auth: authedAuth })
    _resetReferenceCache()
    await server.inject({ method: 'GET', url, auth: authedAuth })

    const calls = vi
      .mocked(wreck.get)
      .mock.calls.map(([u]) => u)
      .filter((u) => u.endsWith('/reference/habitat-types-by-broad'))
    expect(calls).toHaveLength(2)
  })

  test('Does not cache a rejected fetch — next request retries', async () => {
    let attempts = 0
    vi.mocked(wreck.get).mockImplementation((u) => {
      if (u.endsWith('/reference/habitat-types-by-broad')) {
        attempts += 1
        if (attempts === 1) {
          return Promise.reject(new Error('transient backend error'))
        }
      }
      return Promise.resolve(routeWreck(u))
    })

    const first = await server.inject({ method: 'GET', url, auth: authedAuth })
    expect(first.statusCode).toBe(statusCodes.internalServerError)

    const second = await server.inject({ method: 'GET', url, auth: authedAuth })
    expect(second.statusCode).toBe(statusCodes.ok)
    expect(attempts).toBe(2)
  })
})
