import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createServer } from '../../../server.js'
import { statusCodes } from '../../constants.js'

// The auth-scheme.test.js / session-expiry.test.js unit tests mock yar, so they
// cannot prove the `sessionEnded` breadcrumb actually survives yar.reset() +
// yar.set() and a real cookie round-trip. That round-trip is the crux of the
// two-page flow: a 'try'-mode page (the home page) ends an unrefreshable
// session *in place* — the auth scheme throws Boom.unauthorized so the page
// still renders — and the *next* protected request, a separate HTTP round-trip
// carrying the regenerated cookie, must still be treated as an expired session
// rather than a stranger.
//
// So this drives the genuine path end to end: the real try-mode `/` route, whose
// real 'session' scheme detects the expired session and ends it. We seed an
// expired session with NO refresh token, which makes refreshSession short-circuit
// before any network call, so the flow stays hermetic without mocking the IdP.
describe('auth scheme + yar breadcrumb (integration)', () => {
  let server

  // A past `exp` (seconds since epoch) so isSessionExpired treats the seeded
  // session as expired; no refreshToken so the silent refresh cannot renew it.
  const EXPIRED_EXP_SECONDS = 1

  beforeAll(async () => {
    server = await createServer()

    // Plants an expired-and-unrefreshable auth session, exactly the state a
    // browser carries into the try-mode home page once its tokens have died.
    server.route({
      method: 'GET',
      path: '/_test/seed-expired-session',
      options: { auth: false },
      handler(request, h) {
        request.yar.set('auth', {
          user: { sub: 'user-1', exp: EXPIRED_EXP_SECONDS },
          idToken: 'stale-id-token'
        })
        return h.response('seeded')
      }
    })

    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  function sessionCookieFrom(response) {
    const cookies = response.headers['set-cookie'] ?? []
    return cookies
      .map((cookie) => cookie.split(';')[0])
      .find((cookie) => cookie.startsWith('session='))
  }

  test('the try-mode home page ends an expired session in place and still renders', async () => {
    const seeded = await server.inject({
      method: 'GET',
      url: '/_test/seed-expired-session'
    })
    const seedCookie = sessionCookieFrom(seeded)
    expect(seedCookie).toBeTruthy()

    const home = await server.inject({
      method: 'GET',
      url: '/',
      headers: { cookie: seedCookie }
    })

    // A 'try'-mode route must never redirect — it renders signed-out even as the
    // scheme ends the session underneath it.
    expect(home.statusCode).toBe(statusCodes.ok)
    // The regenerated cookie is what carries the breadcrumb to the next click.
    expect(sessionCookieFrom(home)).toBeTruthy()
  })

  test('a protected click after the home page ended the session redirects to /auth/session-expired', async () => {
    const seeded = await server.inject({
      method: 'GET',
      url: '/_test/seed-expired-session'
    })
    const home = await server.inject({
      method: 'GET',
      url: '/',
      headers: { cookie: sessionCookieFrom(seeded) }
    })
    const endedCookie = sessionCookieFrom(home)
    expect(endedCookie).toBeTruthy()

    const res = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      headers: { cookie: endedCookie }
    })

    expect(res.statusCode).toBe(statusCodes.redirect)
    expect(res.headers.location).toBe('/auth/session-expired')
  })

  test('an anonymous home visit plants no breadcrumb, so a later protected click is /auth/forbidden', async () => {
    // Guards the other side of the distinction: visiting the try-mode home page
    // without any session must not leave a sessionEnded breadcrumb behind.
    const home = await server.inject({ method: 'GET', url: '/' })
    const cookie = sessionCookieFrom(home)

    const res = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      ...(cookie ? { headers: { cookie } } : {})
    })

    expect(res.statusCode).toBe(statusCodes.redirect)
    expect(res.headers.location).toBe('/auth/forbidden')
  })

  test('a protected route with no session at all redirects to /auth/forbidden', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/manage-projects'
    })

    expect(res.statusCode).toBe(statusCodes.redirect)
    expect(res.headers.location).toBe('/auth/forbidden')
  })
})
