import { config } from '../../../config/config.js'
import { backendRequest } from '../helpers/auth/backend-request.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

/**
 * Fetch a project from the backend by id, forwarding the user's bearer token.
 * Returns the full response payload, or null if the request fails.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} id - Project UUID
 * @returns {Promise<object|null>}
 */
export async function fetchProject(request, id) {
  try {
    const { payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}/projects/${id}`
    )
    return payload ?? null
  } catch {
    return null
  }
}
