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
    postIntervention: {
      habitatSizes: {
        areaHabitats: { totalSquareMetres: 25000 }
      },
      units: { habitatsTotal: 2.5 },
      habitats: [
        {
          featureId,
          ref: 'P-1',
          type: 'Grassland',
          sizeSquareMetres: 25000,
          units: 2.5
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
      `href="/post-intervention-habitat-details?featureId=${featureId}&projectId=${projectId}"`
    )
    expect(result).toContain(
      `/projects/${projectId}/upload-post-intervention-file`
    )
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
  })

  test('does not render the baseline-only "Units" column heading in the summary table', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).not.toContain('<th class="govuk-table__header">Units</th>')
  })

  test('renders all three unit type rows in the summary table', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Area habitats')
    expect(result).toContain('Hedgerows')
    expect(result).toContain('Watercourses')
  })
})
