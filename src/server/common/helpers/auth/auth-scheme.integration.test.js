import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createServer } from '../../../server.js'
import { statusCodes } from '../../constants.js'
import { expireSession } from './session-expiry.js'

// The auth-scheme.test.js / session-expiry.test.js unit tests mock yar, so they
// cannot prove the `sessionEnded` breadcrumb actually survives yar.reset() +
// yar.set() and a real cookie round-trip. That round-trip is the crux of the
// BMD-829 two-page flow: a 'try'-mode page (e.g. the home page) ends an
// unrefreshable session in place, and the *next* protected request — a separate
// HTTP round-trip carrying the regenerated cookie — must still be treated as an
// expired session, not a stranger. This spins up the real server (real yar,
// real 'session' scheme) and drives two sequential injects to lock that in.
describe('auth scheme + yar breadcrumb (integration)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()

    // Stands in for a 'try'-mode page ending an unrefreshable session in place.
    // It calls the real expireSession against the real yar, so the breadcrumb
    // goes through a genuine reset → set → cookie commit.
    server.route({
      method: 'GET',
      path: '/_test/end-session',
      options: { auth: false },
      handler(request, h) {
        expireSession(request)
        return h.response('ended')
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

  test('a protected route after an ended session redirects to /auth/session-expired', async () => {
    const ended = await server.inject({
      method: 'GET',
      url: '/_test/end-session'
    })
    const cookie = sessionCookieFrom(ended)
    expect(cookie).toBeTruthy()

    const res = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.redirect)
    expect(res.headers.location).toBe('/auth/session-expired')
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
