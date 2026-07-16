import { config } from '../../../config/config.js'
import { backendRequest } from '../helpers/auth/backend-request.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

/**
 * @hapi/wreck's shortcut methods (get/post/patch/...) — which `backendRequest`
 * calls — throw a Boom error for any non-2xx response instead of resolving
 * it; only a genuine transport failure (network error, timeout, DNS) resolves
 * with nothing to catch as a response. Normalise both back into the same
 * `{ statusCode, payload }` shape so a real backend 404/409/etc. is
 * distinguishable from an unreachable backend (which still resolves to
 * `null`, as documented on each exported function below).
 *
 * @param {() => Promise<{res: {statusCode: number}, payload: unknown}>} send
 * @returns {Promise<{statusCode: number, payload: object|null}|null>}
 */
async function callBackend(send) {
  try {
    const { res, payload } = await send()
    return { statusCode: res.statusCode, payload: payload ?? null }
  } catch (error) {
    if (error?.data?.isResponseError) {
      return {
        statusCode: error.data.res.statusCode,
        payload: error.data.payload ?? null
      }
    }
    return null
  }
}

/**
 * Fetch a project from the backend by id, forwarding the user's bearer token.
 * Returns `{ statusCode, payload }` for any HTTP response, or `null` on
 * network / unexpected errors.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} id - Project UUID
 * @returns {Promise<{statusCode: number, payload: object|null}|null>}
 */
export async function fetchProject(request, id) {
  return callBackend(() =>
    backendRequest(request, 'get', `${backendUrl}/projects/${id}`)
  )
}

/**
 * Persist the `details` fragment of a project via the backend's dedicated
 * PATCH endpoint. Returns `{ statusCode, payload }` for any HTTP response, or
 * `null` on network / unexpected errors.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} id - Project UUID
 * @param {object} details - Fields matching backend projectDetailsSchema
 * @returns {Promise<{statusCode: number, payload: object|null}|null>}
 */
export async function patchProjectDetails(request, id, details) {
  return callBackend(() =>
    backendRequest(request, 'patch', `${backendUrl}/projects/${id}/details`, {
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(details)
    })
  )
}
