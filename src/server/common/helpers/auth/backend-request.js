import { statusCodes } from '../../constants.js'
import { wreck } from '../wreck-client.js'
import { buildAuthHeaders } from './build-auth-headers.js'
import { isTokenCurrentlyValid } from './confirm-token-valid.js'
import { refreshSession } from './refresh-session.js'

/**
 * Call a protected backend endpoint with the user's signed Defra ID token
 * attached as `x-defra-id-token` + `x-defra-id-signature` headers. Before
 * forwarding we confirm the session token is unexpired, refreshing it via the
 * refresh_token grant when it is expired or near expiry — an expired token is
 * never forwarded. If the backend still answers 401, we silently refresh once
 * and retry. Returns wreck's `{ res, payload }`; callers keep their own status
 * handling.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {'get'|'post'|'put'|'patch'|'delete'} method
 * @param {string} url absolute backend URL
 * @param {object} [options] wreck options (payload, headers, …)
 */
export async function backendRequest(request, method, url, options = {}) {
  const token = await confirmForwardableToken(request)
  if (token === EXPIRED_UNREFRESHABLE) {
    return unauthorizedResult()
  }

  const send = (forwardToken) =>
    wreck[method](url, {
      ...options,
      headers: { ...options.headers, ...buildAuthHeaders(forwardToken) }
    })

  try {
    const result = await send(token)
    if (isUnauthorized(result)) {
      const refreshed = await refreshSession(request)
      if (refreshed) {
        return await send(refreshed)
      }
    }
    return result
  } catch (error) {
    if (isUnauthorizedError(error)) {
      const refreshed = await refreshSession(request)
      if (refreshed) {
        return await send(refreshed)
      }
    }
    throw error
  }
}

// Sentinel distinguishing "token present but expired and not refreshable" (must
// 401, never forward) from "no token at all" (proceed with no auth headers — the
// auth scheme would already have redirected an unauthenticated user upstream).
const EXPIRED_UNREFRESHABLE = Symbol('expired-unrefreshable')

/**
 * Resolve the token to forward, confirming it is unexpired first.
 *
 *   - No session token        -> undefined (proceed without auth headers).
 *   - Valid session token      -> that token.
 *   - Expired/near-expiry token -> refreshed token, or EXPIRED_UNREFRESHABLE
 *     when it cannot be refreshed (caller must 401 — never forward it).
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<string|undefined|symbol>}
 */
async function confirmForwardableToken(request) {
  const idToken = request.yar?.get('auth')?.idToken
  if (!idToken) {
    return undefined
  }
  if (isTokenCurrentlyValid(idToken)) {
    return idToken
  }
  const refreshed = await refreshSession(request)
  return refreshed ?? EXPIRED_UNREFRESHABLE
}

function unauthorizedResult() {
  return { res: { statusCode: statusCodes.unauthorized }, payload: undefined }
}

function isUnauthorized(result) {
  return result?.res?.statusCode === statusCodes.unauthorized
}

// @hapi/wreck normally returns the response rather than throwing on a 4xx, but
// some paths surface a Boom-shaped error — cover both so a 401 always triggers
// the refresh.
function isUnauthorizedError(error) {
  return (
    error?.output?.statusCode === statusCodes.unauthorized ||
    error?.data?.res?.statusCode === statusCodes.unauthorized
  )
}
