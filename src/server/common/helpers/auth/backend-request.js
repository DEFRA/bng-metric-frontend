import Boom from '@hapi/boom'

import { statusCodes } from '../../constants.js'
import { wreck } from '../wreck-client.js'
import { authHeaders } from './auth-headers.js'
import { refreshSession } from './refresh-session.js'
import { expireSession } from './session-expiry.js'

/**
 * Call a protected backend endpoint with the user's bearer token attached. If
 * the backend answers 401, silently refresh the token once and retry the call
 * with the new token. Returns wreck's `{ res, payload }`; callers keep their own
 * status handling.
 *
 * When the backend rejects the token AND the refresh fails, the session is
 * dead: it is cleared here and a Boom 401 flagged `data.sessionExpired` is
 * thrown, which `catchAll` turns into a redirect to /auth/session-expired
 * rather than rendering a bare error page. (BMD-829)
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

  let result
  let unauthorized
  try {
    result = await send()
    unauthorized = isUnauthorized(result)
  } catch (error) {
    if (!isUnauthorizedError(error)) {
      throw error
    }
    unauthorized = true
  }

  if (!unauthorized) {
    return result
  }
  if (await refreshSession(request)) {
    return send()
  }

  expireSession(request)
  throw sessionExpiredError()
}

function sessionExpiredError() {
  const error = Boom.unauthorized(
    'Backend rejected the bearer token and silent refresh failed'
  )
  error.data = { sessionExpired: true }
  return error
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
