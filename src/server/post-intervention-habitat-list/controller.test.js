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
  roles: ['aaa-bbb:bng completer:3']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const featureId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const url = `/projects/${projectId}/post-intervention-habitat-list`

const mockProject = {
  project: {
    name: 'Greenfield Meadow Restoration',
    baseline: {
      units: {
        habitatsTotal: 8,
        treesTotal: 2,
        hedgerowsTotal: 4,
        watercoursesTotal: 10
      }
    },
    postIntervention: {
      habitatSizes: {
        site: { totalSquareMetres: 20000 },
        areaHabitats: { totalSquareMetres: 25000 },
        hedgerows: { totalMetres: 1500 },
        watercourses: { totalMetres: 750 }
      },
      units: {
        habitatsTotal: 11,
        treesTotal: 2,
        hedgerowsTotal: 6,
        watercoursesTotal: 5,
        habitatsNetUnitChange: 3,
        habitatsNetUnitChangePercentage: 30,
        hedgerowsNetUnitChange: 2,
        hedgerowsNetUnitChangePercentage: 50,
        watercoursesNetUnitChange: -5,
        watercoursesNetUnitChangePercentage: -50
      },
      habitats: [
        {
          featureId,
          ref: 'P-1',
          type: 'Grassland',
          sizeSquareMetres: 25000,
          units: 2.5
        }
      ],
      hedgerows: [
        {
          featureId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          ref: 'H-1',
          sizeMetres: 1500
        }
      ],
      watercourses: [
        {
          featureId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          ref: 'W-1',
          sizeMetres: 750
        }
      ]
    }
  }
}

describe('#postInterventionHabitatListController - GET', () => {
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

  test('renders the post-intervention habitat list', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('On-site post intervention habitats')
    expect(result).toContain('2.5ha')
    expect(result).toContain(
      `href="/post-intervention-habitat-details?featureId=${featureId}&amp;projectId=${projectId}"`
    )
    expect(result).toContain(
      `/projects/${projectId}/upload-file?returnUrl=%2Fprojects%2F${projectId}%2Fpost-intervention-habitat-list`
    )
  })

  test('renders the "Intervention type" column with the persisted value', async () => {
    const enhancedProject = structuredClone(mockProject)
    enhancedProject.project.postIntervention.habitats[0].retentionCategory =
      'Enhanced'
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: enhancedProject
    })

    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Intervention type')
    expect(result).toContain('Enhanced')
  })

  test('Continue button links to backHref', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain(`href="/add-project-details/${projectId}"`)
  })
})

describe('#postInterventionHabitatListController - summary table', () => {
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

  test('renders the post-intervention summary table headings', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Unit type')
    expect(result).toContain('Size')
    expect(result).toContain('Baseline units')
    expect(result).toContain('Post-intervention units')
    expect(result).toContain('Net unit change')
    expect(result).toContain('Net % change')
    expect(result).toContain('Trading rules satisfied')
    expect(result).toContain('app-habitat-summary-table')
  })

  test('does not render the baseline-only "Units" column heading in the summary table', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('<th class="govuk-table__header">Units</th>')
  })

  test('renders all four unit type rows in the summary table', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('>Site<')
    expect(result).toContain('Area habitats')
    expect(result).toContain('Hedgerows')
    expect(result).toContain('Watercourses')
  })

  test('renders persisted sizes, unit totals and net changes', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('2.00ha')
    expect(result).toContain('2.50ha')
    expect(result).toContain('1.50km')
    expect(result).toContain('0.75km')
    expect(result).toContain('10.00')
    expect(result).toContain('13.00')
    expect(result).toContain('30.00%')
    expect(result).toContain('4.00')
    expect(result).toContain('6.00')
    expect(result).toContain('50.00%')
    expect(result).toContain('-5.00')
    expect(result).toContain('-50.00%')
  })

  test('renders empty cells when persisted summary calculations are unavailable', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Greenfield Meadow Restoration',
          postIntervention: { habitatSizes: {} }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('null')
  })
})
