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
  roles: ['aaa-bbb:bng completer:3']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const url = `/project-details/${projectId}`
const mockProject = { project: { name: 'Greenfield Meadow Restoration' } }

describe('#projectDetailsController', () => {
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
    expect(result).toContain('govuk-heading-xl')
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

  test('renders the project name caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Greenfield Meadow Restoration')
  })

  test('renders without caption when project name is missing', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: {} }
    })
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toContain('govuk-caption-l')
  })

  test('returns 502 when backend returns a non-2xx response', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 503 },
      payload: null
    })
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('returns 502 when wreck throws', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Network failure'))
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('returns 502 when backend throws a boom error', async () => {
    vi.mocked(wreck.get).mockRejectedValue(Boom.gatewayTimeout('timeout'))
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })
})

describe('#projectDetailsController - validation', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('returns 400 when projectId is not a UUID', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/project-details/not-a-uuid',
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badRequest)
  })
})

describe('#projectDetailsController - authentication', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('redirects unauthenticated users', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url
    })
    expect(statusCode).toBe(statusCodes.redirect)
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
