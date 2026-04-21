import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'

const authCredentials = {
  sub: 'test-user',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:1']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

const mockProject = {
  project: {
    name: 'Greenfield Meadow Restoration'
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
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockProject)
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

  test('Should show the Layers row', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toEqual(expect.stringContaining('Layers'))
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
