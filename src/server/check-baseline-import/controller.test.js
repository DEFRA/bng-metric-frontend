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

const mockHabitats = [
  { featureId: '11111111-1111-1111-1111-111111111111', ref: 'G-1' },
  { featureId: '22222222-2222-2222-2222-222222222222', ref: 'G-2' }
]

const mockFilename = 'greenfield-baseline.gpkg'

const mockProject = {
  project: {
    name: 'Greenfield Meadow Restoration',
    baseline: {
      filename: mockFilename,
      redLine: { featureId: 'rlb-1' },
      habitats: mockHabitats,
      hedgerows: [{ featureId: 'hr-1' }],
      watercourses: [{ featureId: 'wc-1' }]
    }
  }
}

const projectId = 'aaa-bbb-ccc'
const url = `/projects/${projectId}/check-baseline-import`

describe('#checkBaselineImport - GET', () => {
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

  test('Should render the page with correct title', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Biodiversity Net Gain - Check Baseline import')
    )
  })

  test('Should show the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('Check your on-site baseline data')
    )
  })

  test('Should show the project name as caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('Greenfield Meadow Restoration')
    )
  })

  test('Should show the back link to upload baseline file', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining(
        `href="/projects/${projectId}/upload-baseline-file"`
      )
    )
    expect(result).toEqual(expect.stringContaining('Back'))
  })

  test('Should show the Site Details card', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('govuk-summary-card'))
    expect(result).toEqual(expect.stringContaining('Site Details'))
  })

  test('Should show the Red Line Boundary row', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('Red Line Boundary'))
  })

  test('Should show the Area Habitats row', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('Area Habitats'))
  })

  test('Should render a link to baseline-habitat-details for each habitat', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    for (const habitat of mockHabitats) {
      expect(result).toEqual(
        expect.stringContaining(
          `href="/baseline-habitat-details?projectId=${projectId}&habitatId=${habitat.featureId}"`
        )
      )
      expect(result).toEqual(expect.stringContaining(habitat.ref))
    }
  })

  test('Should tolerate a project with no habitats', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'Empty Project' } }
    })

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Area Habitats'))
    expect(result).not.toEqual(
      expect.stringContaining('href="/baseline-habitat-details')
    )
  })

  test('Should render with fallback caption when the project fetch fails', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('backend down'))

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Project'))
    expect(result).not.toEqual(
      expect.stringContaining('href="/baseline-habitat-details')
    )
  })

  test('Should show the Map View row with placeholder', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('Map View'))
    expect(result).toEqual(
      expect.stringContaining('data-testid="map-placeholder"')
    )
    expect(result).toEqual(expect.stringContaining('alt="Map placeholder"'))
  })

  test('Should show the File Details card', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('File Details'))
  })

  test('Should show the File uploaded row', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('File uploaded'))
  })

  test('Should show the filename from the baseline document', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining(mockFilename))
  })

  test('Should tolerate a project with no baseline filename', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'No Baseline Project' } }
    })

    const { statusCode, result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('File uploaded'))
    expect(result).not.toEqual(expect.stringContaining(mockFilename))
  })

  test('Should show the Layers row', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('Layers'))
  })

  test('Should list the layers present in the baseline document', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    for (const layer of [
      'Red Line Boundary',
      'Habitats',
      'Hedgerows',
      'Watercourses'
    ]) {
      expect(result).toEqual(expect.stringContaining(layer))
    }
  })

  test('Should only list layers that are present in the baseline document', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Partial Layers Project',
          baseline: {
            filename: mockFilename,
            redLine: { featureId: 'rlb-1' },
            habitats: mockHabitats,
            hedgerows: [],
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

    expect(result).toEqual(expect.stringContaining('Red Line Boundary'))
    expect(result).toEqual(expect.stringContaining('Habitats'))
    expect(result).not.toEqual(expect.stringContaining('<li>Hedgerows</li>'))
    expect(result).not.toEqual(expect.stringContaining('<li>Watercourses</li>'))
  })

  test('Should show the Upload a different file button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('Upload a different file'))
    expect(result).toEqual(
      expect.stringContaining(
        `href="/projects/${projectId}/upload-baseline-file"`
      )
    )
  })
})

describe('#checkBaselineImport - authentication', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect unauthenticated users', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url
    })

    expect(statusCode).toBe(302)
  })

  test('Should redirect users without bng completer role', async () => {
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
