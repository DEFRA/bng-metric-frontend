import { statusCodes } from '../../constants.js'
import { wreck } from '../wreck-client.js'
import { authHeaders } from './auth-headers.js'
import { refreshSession } from './refresh-session.js'

/**
 * Call a protected backend endpoint with the user's bearer token attached. If
 * the backend answers 401, silently refresh the token once and retry the call
 * with the new token. Returns wreck's `{ res, payload }`; callers keep their own
 * status handling.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {'get'|'post'|'put'|'patch'|'delete'} method
 * @param {string} url absolute backend URL
 * @param {object} [options] wreck options (payload, headers, …)
 */
export async function backendRequest(request, method, url, options = {}) {
  const send = () =>
    wreck[method](url, {
      ...options,
      headers: { ...options.headers, ...authHeaders(request) }
    })

  try {
    const result = await send()
    if (isUnauthorized(result) && (await refreshSession(request))) {
      return await send()
    }
    return result
  } catch (error) {
    if (isUnauthorizedError(error) && (await refreshSession(request))) {
      return await send()
    }
    throw error
  }
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
