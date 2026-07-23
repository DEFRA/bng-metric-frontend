const MS_PER_SECOND = 1000

// Treat a token due to expire within this window as already expired, so we
// refresh it before a backend call made later in the same request can fail.
const EXPIRY_LEEWAY_SECONDS = 30

export const SESSION_EXPIRED_PATH = '/auth/session-expired'

// yar key holding a breadcrumb left behind when we end an expired session, so a
// later request can tell an expired-then-cleared session apart from a browser
// that never signed in. (BMD-829)
export const SESSION_ENDED_KEY = 'sessionEnded'

/**
 * Whether the session's tokens have expired (or are about to). Reads the `exp`
 * claim (seconds since epoch) that the IdP set on the ID token — the same
 * token we forward to the backend, which independently rejects it once `exp`
 * passes. A session whose claims carry no readable `exp` is treated as
 * expired: it forces a silent refresh rather than trusting an undated token.
 *
 * @param {{ user?: { exp?: number } } | null | undefined} session the yar 'auth' entry
 * @param {number} [nowMs] current time in ms (injectable for tests)
 * @returns {boolean}
 */
export function isSessionExpired(session, nowMs = Date.now()) {
  const exp = session?.user?.exp
  if (typeof exp !== 'number') {
    return true
  }
  return exp <= nowMs / MS_PER_SECOND + EXPIRY_LEEWAY_SECONDS
}

/**
 * End the authenticated session. Uses yar's reset() — the same primitive as
 * logout — because it drops the server-side cache entry and regenerates the
 * session id, so a replayed old cookie cannot resurrect the dead session
 * (clear('auth') alone leaves the cached copy in place). Called when the
 * tokens are dead and the IdP refused to renew them.
 *
 * After resetting, it drops a `sessionEnded` breadcrumb into the fresh (empty)
 * session. A public 'try'-mode page (e.g. the home page) ends the session here
 * without redirecting, so by the time the user clicks through to a protected
 * route the tokens and user are already gone — the store looks identical to a
 * browser that never signed in. The breadcrumb lets the auth scheme send an
 * expired user to /auth/session-expired ("Sign in again") while leaving a
 * genuinely-anonymous user on /auth/forbidden. It carries no user or tokens,
 * so the shared header still renders signed-out. (BMD-829)
 *
 * @param {import('@hapi/hapi').Request} request
 */
export function expireSession(request) {
  request.yar?.reset()
  request.yar?.set(SESSION_ENDED_KEY, true)
}

/**
 * Whether this browser's session was ended by expiry (rather than never having
 * signed in), per the breadcrumb expireSession leaves behind.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {boolean}
 */
export function wasSessionEnded(request) {
  return Boolean(request.yar?.get(SESSION_ENDED_KEY))
}

/**
 * Drop the `sessionEnded` breadcrumb. Called once a fresh session is
 * established (a successful login) so a browser that previously had an expired
 * session no longer counts as "session expired" — otherwise the stale
 * breadcrumb would linger for the cookie's lifetime. (BMD-829)
 *
 * @param {import('@hapi/hapi').Request} request
 */
export function clearSessionEnded(request) {
  request.yar?.clear(SESSION_ENDED_KEY)
}
