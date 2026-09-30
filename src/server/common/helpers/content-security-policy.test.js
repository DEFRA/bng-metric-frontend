import { createServer } from '../../server.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('sets the expected CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const policy = resp.headers['content-security-policy']
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).not.toContain('unsafe-inline')
  })
})
