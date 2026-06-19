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

const mockProject = {
  project: {
    name: 'Greenfield Meadow Restoration',
    baseline: {
      habitatSizes: {
        areaHabitats: { totalSquareMetres: 25000 },
        hedgerows: { totalMetres: 2500 },
        watercourses: { totalMetres: 1000 }
      },
      hedgerows: [{ featureId: 'h-1' }],
      watercourses: [{ featureId: 'w-1' }],
      units: {
        totalUnits: 12.5,
        habitatsTotal: 5.123,
        hedgerowsTotal: 4.5,
        watercoursesTotal: 3.0
      }
    }
  }
}

const mockHabitat = {
  featureId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ref: 'P-1',
  type: 'Grassland',
  sizeSquareMetres: 25000,
  distinctiveness: 'Low',
  condition: 'Good',
  units: 2.5,
  status: 'Complete'
}

const mockHabitatNullFields = {
  featureId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  ref: 'P-2',
  type: null,
  sizeSquareMetres: null,
  distinctiveness: null,
  condition: null,
  units: null,
  status: null
}

const mockProjectWithHabitats = {
  project: {
    name: 'Greenfield Meadow Restoration',
    baseline: {
      habitats: [mockHabitat, mockHabitatNullFields]
    }
  }
}

const authCredentials = {
  sub: 'test-user',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:1']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const url = `/projects/${projectId}/baseline-habitat-list`

describe('#habitatListController - GET', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProject
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 200', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('On-site baseline habitats')
  })

  test('renders the project name as caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Greenfield Meadow Restoration')
  })

  test('renders the summary table', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Unit type')
    expect(result).toContain('Size')
    expect(result).toContain('Units')
    expect(result).toContain('Area habitats')
    expect(result).toContain('Hedgerows')
    expect(result).toContain('Watercourses')
  })

  test('renders the total area habitat size in hectares', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('2.5ha')
  })

  test('renders the total hedgerow size in kilometres', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('2.5km')
  })

  test('renders the total watercourse size in kilometres', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('1km')
  })

  test('shows "No data" for hedgerows when their total size is zero', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Greenfield Meadow Restoration',
          baseline: {
            habitatSizes: {
              areaHabitats: { totalSquareMetres: 25000 },
              hedgerows: { totalMetres: 0 },
              watercourses: { totalMetres: 1000 }
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No data')
    expect(result).toContain('1km')
    expect(result).not.toContain('0km')
  })

  test('shows "No data" for watercourses when their total size is zero', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Greenfield Meadow Restoration',
          baseline: {
            habitatSizes: {
              areaHabitats: { totalSquareMetres: 25000 },
              hedgerows: { totalMetres: 2500 },
              watercourses: { totalMetres: 0 }
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No data')
    expect(result).toContain('2.5km')
    expect(result).not.toContain('0km')
  })

  test('shows "No data" for hedgerows and watercourses when habitatSizes is missing', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'Greenfield Meadow Restoration' } }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    const noDataMatches = result.match(/No data/g) ?? []
    expect(noDataMatches.length).toBeGreaterThanOrEqual(2)
  })

  test('renders the total area habitat units to 2 decimal places (AC1)', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // habitatsTotal 5.123 → '5.12'
    expect(result).toContain('5.12')
  })

  test('renders the total hedgerow units to 2 decimal places (AC2)', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // hedgerowsTotal 4.5 → '4.50'
    expect(result).toContain('4.50')
  })

  test('renders the total watercourse units to 2 decimal places (AC5)', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // watercoursesTotal 3.0 → '3.00'
    expect(result).toContain('3.00')
  })

  test('shows "No data" for hedgerow units when no hedgerow habitats exist (AC4)', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Greenfield Meadow Restoration',
          baseline: {
            habitatSizes: {
              areaHabitats: { totalSquareMetres: 25000 }
            },
            hedgerows: [],
            watercourses: [{ featureId: 'w-1' }],
            units: {
              totalUnits: 8,
              habitatsTotal: 5,
              hedgerowsTotal: 0,
              watercoursesTotal: 3
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No data')
    expect(result).toContain('3.00')
    expect(result).not.toContain('0.00')
  })

  test('shows "No data" for watercourse units when no watercourse habitats exist (AC6)', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Greenfield Meadow Restoration',
          baseline: {
            habitatSizes: {
              areaHabitats: { totalSquareMetres: 25000 }
            },
            hedgerows: [{ featureId: 'h-1' }],
            watercourses: [],
            units: {
              totalUnits: 9,
              habitatsTotal: 5,
              hedgerowsTotal: 4,
              watercoursesTotal: 0
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No data')
    expect(result).toContain('4.00')
    expect(result).not.toContain('0.00')
  })

  test('caps unit totals at 7 significant figures', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Greenfield Meadow Restoration',
          baseline: {
            habitatSizes: {
              areaHabitats: { totalSquareMetres: 25000 }
            },
            hedgerows: [{ featureId: 'h-1' }],
            watercourses: [{ featureId: 'w-1' }],
            units: {
              totalUnits: 1234567.89,
              habitatsTotal: 1234567.89,
              hedgerowsTotal: 1,
              watercoursesTotal: 1
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // 1234567.89 → 7 sig figs → 1234568 → 2 dp → '1234568.00'
    expect(result).toContain('1234568.00')
  })

  test('renders the tabs component', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('govuk-tabs')
  })

  test('renders all three habitat tabs', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('id="area-habitats"')
    expect(result).toContain('id="hedgerows"')
    expect(result).toContain('id="watercourses"')
  })

  test('falls back to "Project" caption when the API call throws', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('network error'))

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Project')
  })

  test('falls back to "Project" caption when project name is missing', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: {} }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Project')
  })

  test('renders the back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('govuk-back-link')
    expect(result).toContain(`/add-project-details/${projectId}`)
  })

  test('renders the action buttons', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Upload a different file')
    expect(result).toContain('Continue')
    expect(result).not.toContain('Show map')
  })
})

describe('#habitatListController - validation', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('rejects an invalid project id with 400', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/baseline-habitat-list',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})

describe('#habitatListController - authentication', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('redirects unauthenticated users', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toContain('/auth')
  })

  test('redirects users without bng completer role', async () => {
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

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })
})

describe('#habitatListController - sortable table markup', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProject
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders the moj-sortable-table data-module attribute', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('data-module="moj-sortable-table"')
  })

  test('renders aria-sort on the Ref column header (ascending by default)', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('aria-sort="ascending"')
  })

  test('renders aria-sort="none" on the remaining column headers', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('aria-sort="none"')
  })
})

describe('#habitatListController - habitat rows', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProjectWithHabitats
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders a link to baseline-habitat-details for each habitat', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain(
      `href="/baseline-habitat-details?featureId=${mockHabitat.featureId}&projectId=${projectId}"`
    )
    expect(result).toContain(
      `href="/baseline-habitat-details?featureId=${mockHabitatNullFields.featureId}&projectId=${projectId}"`
    )
  })

  test('renders the habitat ref as the link text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('>P-1<')
    expect(result).toContain('>P-2<')
  })

  test('renders data-sort-value with the ref on the ref cell', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('data-sort-value="P-1"')
  })

  test('converts sizeSquareMetres to hectares for display', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // 25 000 m² → 2.5ha
    expect(result).toContain('>2.5ha<')
  })

  test('renders units formatted to 2 decimal places', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // mockHabitat.units = 2.5 → formatHabitatUnits → '2.50'
    expect(result).toContain('>2.50<')
  })

  test('renders an empty string when units is null', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Test Project',
          baseline: { habitats: [mockHabitatNullFields] }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('>null<')
  })

  test('renders the raw sizeSquareMetres as data-sort-value on the area cell', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('data-sort-value="25000"')
  })

  test('renders type, distinctiveness and condition', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Grassland')
    expect(result).toContain('Low')
    expect(result).toContain('Good')
  })

  test('renders an empty string for null type, distinctiveness and condition', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('>null<')
  })

  test('renders an empty string for status when status is null', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Test Project',
          baseline: { habitats: [mockHabitatNullFields] }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('Complete')
  })

  test('does not render habitat rows when baseline habitats are absent', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'Empty Project' } }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toContain('href="/baseline-habitat-details?')
  })
})

describe('#habitatListController - hedgerow rows', () => {
  let server

  const mockHedgerow = {
    featureId: 'hedge-1234',
    ref: 'H-1',
    type: 'Native hedgerow',
    sizeMetres: 1234.567,
    distinctiveness: 'Low',
    condition: 'Good',
    units: 8,
    status: 'Complete'
  }

  const mockProjectWithHedgerows = {
    project: {
      name: 'Hedgerow Project',
      baseline: {
        hedgerows: [mockHedgerow]
      }
    }
  }

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProjectWithHedgerows
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders a baseline-habitat-details link for each hedgerow using featureId', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain(
      `href="/baseline-habitat-details?featureId=${mockHedgerow.featureId}&projectId=${projectId}"`
    )
    expect(result).toContain('>H-1<')
  })

  test('renders length in km (not square metres) for each hedgerow', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // 1234.567 m → 1.234567 km
    expect(result).toContain('>1.234567km<')
  })
})

describe('#habitatListController - tab labels and column headers', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProject
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders the Areas tab label', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Areas')
  })

  test('renders the Hedgerows tab label', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Hedgerows')
  })

  test('renders the Watercourses tab label', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Watercourses')
  })

  test('renders the Area column header in the area habitats tab', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('>Area<')
  })

  test('renders the Length column header in the hedgerows tab', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Length')
  })

  test('renders the Size column header in the watercourses tab', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Size')
  })

  test('renders the Status column header in all tabs', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    const statusMatches = result.match(/\bStatus\b/g) ?? []
    expect(statusMatches.length).toBeGreaterThanOrEqual(3)
  })
})

describe('#habitatListController - watercourse rows', () => {
  let server

  const mockWatercourse = {
    featureId: 'water-1234',
    ref: 'WC-1',
    type: 'Ditch',
    sizeMetres: 500,
    distinctiveness: 'Medium',
    condition: 'Moderate',
    units: 1.5,
    status: 'Complete'
  }

  const mockWatercourseNullFields = {
    featureId: 'water-5678',
    ref: 'WC-2',
    type: null,
    sizeMetres: null,
    distinctiveness: null,
    condition: null,
    units: null,
    status: null
  }

  const mockProjectWithWatercourses = {
    project: {
      name: 'Watercourse Project',
      baseline: {
        watercourses: [mockWatercourse]
      }
    }
  }

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProjectWithWatercourses
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders a baseline-habitat-details link for each watercourse using featureId', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain(
      `href="/baseline-habitat-details?featureId=${mockWatercourse.featureId}&projectId=${projectId}"`
    )
  })

  test('renders the watercourse ref as the link text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('>WC-1<')
  })

  test('renders data-sort-value with the ref on the ref cell', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('data-sort-value="WC-1"')
  })

  test('renders size in km for each watercourse', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // 500 m → 0.5 km
    expect(result).toContain('>0.5km<')
  })

  test('renders raw sizeMetres as data-sort-value on the size cell', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('data-sort-value="500"')
  })

  test('renders type, distinctiveness and condition', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Ditch')
    expect(result).toContain('Medium')
    expect(result).toContain('Moderate')
  })

  test('renders units formatted to 2 decimal places', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    // units 1.5 → '1.50'
    expect(result).toContain('>1.50<')
  })

  test('renders status', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Complete')
  })

  test('renders empty strings for null type, distinctiveness, condition, units and status', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Watercourse Project',
          baseline: { watercourses: [mockWatercourseNullFields] }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('>null<')
  })

  test('does not render watercourse rows when baseline watercourses are absent', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'Empty Project' } }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toContain('WC-1')
    expect(result).toContain('No watercourse data uploaded.')
  })

  test('renders multiple watercourse rows', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Watercourse Project',
          baseline: {
            watercourses: [mockWatercourse, mockWatercourseNullFields]
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain(
      `href="/baseline-habitat-details?featureId=${mockWatercourse.featureId}&projectId=${projectId}"`
    )
    expect(result).toContain(
      `href="/baseline-habitat-details?featureId=${mockWatercourseNullFields.featureId}&projectId=${projectId}"`
    )
  })
})

describe('#habitatListController - no hedgerow data', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows "No hedgerow data uploaded." when hedgerows is absent from the baseline', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'No Hedgerow Project',
          baseline: {
            habitats: [],
            watercourses: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No hedgerow data uploaded.')
  })

  test('shows "No hedgerow data uploaded." when hedgerows is an empty array', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Empty Hedgerows Project',
          baseline: {
            hedgerows: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No hedgerow data uploaded.')
  })

  test('shows "No hedgerow data uploaded." when the entire baseline is absent', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'No Baseline Project' } }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No hedgerow data uploaded.')
  })

  test('does not show the hedgerow table when there are no hedgerows', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'No Hedgerow Project',
          baseline: { hedgerows: [] }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('Length')
  })

  test('does not show "No hedgerow data uploaded." when hedgerows are present', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Hedgerow Project',
          baseline: {
            hedgerows: [
              {
                featureId: 'hedge-abc',
                ref: 'H-1',
                type: 'Native hedgerow',
                sizeMetres: 500,
                distinctiveness: 'Low',
                condition: 'Good',
                units: 1,
                status: 'Complete'
              }
            ]
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('No hedgerow data uploaded.')
  })
})

describe('#habitatListController - no watercourse data', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows "No watercourse data uploaded." when watercourses is absent from the baseline', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'No Watercourse Project',
          baseline: {
            habitats: [],
            hedgerows: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No watercourse data uploaded.')
  })

  test('shows "No watercourse data uploaded." when watercourses is an empty array', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Empty Watercourses Project',
          baseline: {
            watercourses: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No watercourse data uploaded.')
  })

  test('shows "No watercourse data uploaded." when the entire baseline is absent', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'No Baseline Project' } }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('No watercourse data uploaded.')
  })

  test('does not show the watercourse table when there are no watercourses', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'No Watercourse Project',
          baseline: { watercourses: [] }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('id="watercourses" class="govuk-table"')
  })

  test('does not show "No watercourse data uploaded." when watercourses are present', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Watercourse Project',
          baseline: {
            watercourses: [
              {
                featureId: 'wc-abc',
                ref: 'WC-1',
                type: 'Ditch',
                sizeMetres: 200,
                distinctiveness: 'Low',
                condition: 'Good',
                units: 1,
                status: 'Complete'
              }
            ]
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('No watercourse data uploaded.')
  })
})
