import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'
import { backendRequest } from '../helpers/auth/backend-request.js'

const logger = createLogger()

const backendUrl = config.get('backend').url.replace(/\/$/, '')

/**
 * Fetch a project's site report from the backend, as PDF bytes.
 *
 * `json: false` is load-bearing. `wreck-client.js` sets `json: true` as a
 * default for every call, which would have Wreck parse the PDF as JSON and
 * throw on the first byte. Turning it off is what makes the payload arrive as
 * the Buffer this returns.
 *
 * Returns `{ statusCode, pdf }` for any HTTP response, or `null` when the
 * backend could not be reached at all — the same shape the other services in
 * this directory use, so callers distinguish "the backend said no" from "there
 * was no backend".
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} projectId
 * @returns {Promise<{statusCode: number, pdf: Buffer|null}|null>}
 */
async function fetchSiteReport(request, projectId) {
  const url = `${backendUrl}/projects/${projectId}/report.pdf`

  try {
    const { res, payload } = await backendRequest(request, 'get', url, {
      json: false
    })
    return { statusCode: res.statusCode, pdf: payload ?? null }
  } catch (error) {
    // A dead, unrefreshable session must reach the global error handler so it
    // can redirect to /auth/session-expired rather than being reported here as
    // a generic backend failure.
    if (error?.data?.sessionExpired) {
      throw error
    }
    if (error?.data?.isResponseError) {
      return { statusCode: error.data.res.statusCode, pdf: null }
    }

    logger.error(
      `Error fetching site report - projectId: ${projectId}, message: ${error?.message}`
    )
    return null
  }
}

export { fetchSiteReport }
