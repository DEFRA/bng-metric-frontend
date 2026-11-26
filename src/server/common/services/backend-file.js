import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'
import { backendRequest } from '../helpers/auth/backend-request.js'
import { isRateLimited } from '../helpers/rate-limited.js'

const logger = createLogger()

const backendUrl = config.get('backend').url.replace(/\/$/, '')

/**
 * Fetch a file the backend generates for a project (the site report, the
 * metric workbook), as bytes.
 *
 * `json: false` is load-bearing. `wreck-client.js` sets `json: true` as a
 * default for every call, which would have Wreck parse the file as JSON and
 * throw on the first byte. Turning it off is what makes the payload arrive as
 * the Buffer this returns.
 *
 * Returns `{ statusCode, bytes, headers }` for any HTTP response, or `null` when the
 * backend could not be reached at all — the same shape the other services in
 * this directory use, so callers distinguish "the backend said no" from "there
 * was no backend".
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {object} file
 * @param {string} file.projectId
 * @param {string} file.path - backend path, starting with `/`
 * @param {string} file.what - what the file is, for the logs ("site report")
 * The headers are the backend's, so a caller can honour its `Retry-After`.
 *
 * @returns {Promise<{statusCode: number, bytes: Buffer|null, headers: object}|null>}
 */
async function fetchBackendFile(request, { projectId, path, what }) {
  try {
    const { res, payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}${path}`,
      { json: false }
    )
    return {
      statusCode: res.statusCode,
      bytes: payload ?? null,
      headers: res.headers ?? {}
    }
  } catch (error) {
    // A dead, unrefreshable session must reach the global error handler so it
    // can redirect to /auth/session-expired rather than being reported here as
    // a generic backend failure.
    if (error?.data?.sessionExpired) {
      throw error
    }
    // So must a refusal by a rate limit, which shows the "too many requests"
    // page. It is not a backend failure, so it is not logged as one.
    if (isRateLimited(error)) {
      logger.info(
        `Backend rate limit refused the ${what} - projectId: ${projectId}, retryAfterSeconds: ${error.data.retryAfterSeconds ?? 'unset'}`
      )
      throw error
    }
    if (error?.data?.isResponseError) {
      return {
        statusCode: error.data.res.statusCode,
        bytes: null,
        headers: error.data.res.headers ?? {}
      }
    }

    logger.error(
      `Error fetching the ${what} - projectId: ${projectId}, message: ${error?.message}`
    )
    return null
  }
}

export { fetchBackendFile }
