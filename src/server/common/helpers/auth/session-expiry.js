const MS_PER_SECOND = 1000

// Treat a token due to expire within this window as already expired, so we
// refresh it before a backend call made later in the same request can fail.
const EXPIRY_LEEWAY_SECONDS = 30

export const SESSION_EXPIRED_PATH = '/auth/session-expired'

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
 * @param {import('@hapi/hapi').Request} request
 */
export function expireSession(request) {
  request.yar?.reset()
}
