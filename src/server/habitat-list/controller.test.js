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

const mockProject = { project: { name: 'Greenfield Meadow Restoration' } }

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
const url = `/projects/${projectId}/habitat-list`

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

  test('renders the back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('govuk-back-link')
    expect(result).toContain(`/projects/${projectId}/check-baseline-import`)
  })

  test('renders the action buttons', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })

    expect(result).toContain('Show map')
    expect(result).toContain('Upload a different file')
    expect(result).toContain('Continue')
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
