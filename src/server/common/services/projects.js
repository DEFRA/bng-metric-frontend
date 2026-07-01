import { config } from '../../../config/config.js'
import { backendRequest } from '../helpers/auth/backend-request.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

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
  try {
    const { res, payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}/projects/${id}`
    )
    return { statusCode: res.statusCode, payload: payload ?? null }
  } catch {
    return null
  }
}
