import { config } from '../../../config/config.js'
import { wreck } from '../helpers/wreck-client.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

/**
 * Fetch a project from the backend by id.
 * Returns the full response payload, or null if the request fails.
 *
 * @param {string} id - Project UUID
 * @returns {Promise<object|null>}
 */
export async function fetchProject(id) {
  try {
    const { payload } = await wreck.get(`${backendUrl}/projects/${id}`)
    return payload ?? null
  } catch {
    return null
  }
}
