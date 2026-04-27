/**
 * Cross-cutting guard for the CSRF wiring.
 *
 * The intent of this file is not to test crumb itself (the library has its
 * own coverage) but to pin the integration that the rest of the app relies
 * on: that a server-rendered page exposes a non-empty token in the
 * `<meta name="csrf-token">` tag, that the token round-trips through the
 * cookie correctly, and that the protection still rejects token-less POSTs.
 *
 * Without this, regressions can be silent: removing `with context` from a
 * future layout's `appForm` import, dropping the meta tag from the head
 * block, or flipping `addToViewContext` off in `csrf.js` would all leave
 * server-rendered forms working (the macro path) while JS fetch clients
 * start submitting empty tokens and 403ing with no obvious cause.
 */
import { createServer } from '../../server.js'

const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'csrf-test-user',
    email: 'csrf@example.com',
    roles: ['aaa-bbb:bng completer:1']
  }
}

function extractCrumbCookie(headers) {
  const setCookie = headers['set-cookie']
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : [setCookie].filter(Boolean)
  return cookies.find((c) => String(c).startsWith('crumb='))
}

function metaToken(payload) {
  return payload.match(/<meta name="csrf-token" content="([^"]*)">/)?.[1]
}

function cookieToken(setCookieValue) {
  return setCookieValue?.split(';')[0].split('=')[1]
}

describe('CSRF wiring', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('on a public page render', () => {
    let response

    beforeAll(async () => {
      response = await server.inject({ method: 'GET', url: '/about' })
    })

    test('the csrf-token meta tag is present and non-empty', () => {
      expect(response.statusCode).toBe(200)

      const token = metaToken(response.payload)
      expect(token).toBeDefined()
      expect(token).not.toBe('')
      expect(token.length).toBeGreaterThan(10)
    })

    test('the meta-tag token matches the crumb cookie set on the same response', () => {
      const token = metaToken(response.payload)
      const cookie = extractCrumbCookie(response.headers)

      expect(token).toBeTruthy()
      expect(cookie).toBeTruthy()
      expect(cookieToken(cookie)).toBe(token)
    })

    test('the crumb cookie carries HttpOnly, SameSite=Lax, and Path=/', () => {
      const cookie = extractCrumbCookie(response.headers)
      expect(cookie).toMatch(/HttpOnly/i)
      expect(cookie).toMatch(/SameSite=Lax/i)
      expect(cookie).toMatch(/Path=\//i)
    })
  })

  describe('appForm macro integration', () => {
    test("the form's hidden crumb input matches the meta-tag token on the same render", async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/define-project-name',
        auth: authedAuth
      })

      const meta = metaToken(res.payload)
      const formInput = res.payload.match(
        /<input type="hidden" name="crumb" value="([^"]*)">/
      )?.[1]

      expect(meta).toBeTruthy()
      expect(formInput).toBeTruthy()
      expect(formInput).toBe(meta)
    })
  })

  describe('enforcement on unsafe methods', () => {
    test('POST without a crumb is rejected with 403', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/define-project-name',
        payload: { projectName: 'irrelevant' },
        auth: authedAuth
      })

      expect(res.statusCode).toBe(403)
    })

    test('POST is accepted when the meta-tag token is supplied with the cookie', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true })

      const get = await server.inject({
        method: 'GET',
        url: '/define-project-name',
        auth: authedAuth
      })

      const token = metaToken(get.payload)
      const cookie = extractCrumbCookie(get.headers).split(';')[0]

      const post = await server.inject({
        method: 'POST',
        url: '/define-project-name',
        payload: { projectName: 'My Valid Project', crumb: token },
        headers: { cookie },
        auth: authedAuth
      })

      expect(post.statusCode).not.toBe(403)
      expect(post.statusCode).toBe(302)

      vi.restoreAllMocks()
    })
  })
})
