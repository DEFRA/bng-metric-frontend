import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'

const authCredentials = {
  sub: 'test-user-123',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:1']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

describe('#invalidFileController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('serves the page at /invalid-file', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/invalid-file',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders the expected page title', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/invalid-file',
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining(
        '<title>Biodiversity Net Gain - There is a problem with your file</title>'
      )
    )
  })

  test('renders fallback copy when no baseline errors are in session', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/invalid-file',
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('There is a problem with your file')
    )
    expect(result).toEqual(expect.stringContaining("couldn't accept your file"))
  })

  test('redirects unauthenticated requests', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/invalid-file'
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })
})
