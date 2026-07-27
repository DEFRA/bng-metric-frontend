const MS_PER_SECOND = 1000

// Treat a token due to expire within this window as already expired, so we
// refresh it before a backend call made later in the same request can fail.
const EXPIRY_LEEWAY_SECONDS = 30

export const SESSION_EXPIRED_PATH = '/auth/session-expired'

// yar key holding a breadcrumb left behind when we end an expired session, so a
// later request can tell an expired-then-cleared session apart from a browser
// that never signed in.
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
 * so the shared header still renders signed-out.
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
 * Renew the session's sliding idle-timeout on an authenticated request.
 *
 * yar only re-writes the server-side cache entry (and re-issues the cookie,
 * resetting its Max-Age) when the session is MODIFIED during the request — a run
 * of read-only page views leaves the store untouched, so without this the TTL
 * would count down from the last write (login / last token refresh) rather than
 * from the last request. Re-setting the auth entry to itself marks the session
 * dirty so yar's onPreResponse commit resets the cache expiry and cookie ttl to
 * the full configured window (SESSION_TTL_SECONDS) from now. The result is a
 * true idle-timeout: an active user never ages out, and only genuine inactivity
 * ends the session. No-op when there is no authenticated session to renew.
 *
 * @param {import('@hapi/hapi').Request} request
 */
export function touchSession(request) {
  const auth = request.yar?.get('auth')
  if (auth) {
    request.yar.set('auth', auth)
  }
}

/**
 * Drop the `sessionEnded` breadcrumb. Called once a fresh session is
 * established (a successful login) so a browser that previously had an expired
 * session no longer counts as "session expired" — otherwise the stale
 * breadcrumb would linger for the cookie's lifetime.
 *
 * @param {import('@hapi/hapi').Request} request
 */
export function clearSessionEnded(request) {
  request.yar?.clear(SESSION_ENDED_KEY)
}
