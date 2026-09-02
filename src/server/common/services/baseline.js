import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { createLogger } from '../helpers/logging/logger.js'
import { backendRequest } from '../helpers/auth/backend-request.js'
import { HABITAT_UPLOAD_TYPES } from '../helpers/habitat-upload-types.js'

const logger = createLogger()

const backendUrl = config.get('backend').url

/**
 * Bounds applied to a `Retry-After` we are told to honour.
 *
 * The header comes from another service, so it is treated as a hint rather than
 * an instruction: too small and a saturated backend gets hammered by every
 * waiting browser, too large and the user stares at a spinner long past the
 * point the service recovered. Anything outside the range, or unparseable, falls
 * back to the caller's own default.
 */
const MIN_RETRY_AFTER_SECONDS = 1
const MAX_RETRY_AFTER_SECONDS = 30

/**
 * Seconds from a `Retry-After` header, or null if it does not carry a usable
 * one.
 *
 * Only the delta-seconds form is understood. The spec also allows an HTTP-date,
 * but the only producer we honour this from is our own backend, which always
 * sends seconds — and guessing at a date would be more code than the fallback it
 * would save.
 *
 * @param {object} [headers] response headers, lower-cased as Node delivers them
 * @returns {number|null}
 */
function retryAfterSeconds(headers) {
  const raw = headers?.['retry-after']
  const seconds = Number.parseInt(raw, 10)
  if (!Number.isFinite(seconds)) {
    return null
  }
  if (seconds < MIN_RETRY_AFTER_SECONDS || seconds > MAX_RETRY_AFTER_SECONDS) {
    return null
  }
  return seconds
}

async function validateHabitatUpload(request, uploadType, projectId, uploadId) {
  const url = `${backendUrl}/${uploadType.backendValidatePath}/validate/${uploadId}`

  logger.info(
    `Validating ${uploadType.label} habitats - url: ${url}, projectId: ${projectId}, uploadId: ${uploadId}`
  )

  try {
    const { payload } = await backendRequest(request, 'post', url, {
      payload: JSON.stringify({ projectId }),
      headers: { 'Content-Type': 'application/json' },
      // Overrides the short default every other backend call uses. Validation
      // is the one call that legitimately takes seconds.
      timeout: config.get('backend').validateTimeoutMs
    })

    if (!payload.valid) {
      const errors = Array.isArray(payload.errors) ? payload.errors : []
      logger.info(
        `${uploadType.label} habitat validation failed - uploadId: ${uploadId}, errorCount: ${errors.length}, codes: ${errors.map((e) => e.code).join(',')}`
      )
      return { valid: false, errors }
    }

    return { valid: true }
  } catch (error) {
    const statusCode = error?.output?.statusCode
    const responsePayload = error?.data?.payload

    logger.error(
      `Error validating ${uploadType.label} habitats - uploadId: ${uploadId}, statusCode: ${statusCode}, responsePayload: ${JSON.stringify(responsePayload)}, message: ${error?.message}`
    )

    // 503 means every validation worker was busy and the file was never
    // looked at. It is the one backend failure that is NOT about the user's
    // file, so it must not reach the "there is a problem with your file"
    // screen — the answer is simply to try again in a moment.
    if (statusCode === statusCodes.serviceUnavailable) {
      // The backend decides the pace, because it is the side that knows how
      // loaded it is. Null here just means "use your own default".
      const retryAfter = retryAfterSeconds(error?.data?.res?.headers)
      logger.warn(
        `${uploadType.label} habitat validation refused as busy - uploadId: ${uploadId}, retryAfter: ${retryAfter ?? 'unset'}`
      )
      return {
        valid: false,
        busy: true,
        retryAfterSeconds: retryAfter,
        errors: []
      }
    }

    // Client errors from the backend indicate a validation problem —
    // surface the structured errors if present.
    if (
      statusCode >= statusCodes.badRequest &&
      statusCode < statusCodes.internalServerError
    ) {
      const errors = Array.isArray(responsePayload?.errors)
        ? responsePayload.errors
        : [
            {
              code: 'VALIDATION_FAILED',
              message: responsePayload?.error ?? 'Unable to validate file'
            }
          ]
      return { valid: false, errors }
    }

    // Server or network errors — throw a Boom error so Hapi handles
    // the response with the appropriate HTTP status code
    throw Boom.badGateway('Unable to validate file', error)
  }
}

/**
 * Call the backend to validate the uploaded baseline file.
 *
 * Returns the structured error array when validation fails, so the
 * controller can hand the detail to the dropout page (BMD-367).
 *
 * The projectId is passed in the JSON body so the backend can persist the
 * unpacked baseline data against the project when validation passes. If
 * validation fails, the backend returns structured errors and nothing is
 * persisted.
 *
 * @param {import('@hapi/hapi').Request} request - forwards the user's bearer token
 * @param {string} projectId - The project to persist the baseline against
 * @param {string} uploadId - The upload ID to validate
 * @returns {Promise<{valid: boolean, busy?: boolean, retryAfterSeconds?: number|null, errors?: object[]}>}
 */
export async function validateBaseline(request, projectId, uploadId) {
  return validateHabitatUpload(
    request,
    HABITAT_UPLOAD_TYPES.baseline,
    projectId,
    uploadId
  )
}

/**
 * Call the backend to validate an uploaded post-intervention habitats file.
 *
 * @param {import('@hapi/hapi').Request} request - forwards the user's bearer token
 * @param {string} projectId - The project to persist the post-intervention data against
 * @param {string} uploadId - The upload ID to validate
 * @returns {Promise<{valid: boolean, errors?: object[]}>}
 */
export async function validatePostIntervention(request, projectId, uploadId) {
  return validateHabitatUpload(
    request,
    HABITAT_UPLOAD_TYPES.postIntervention,
    projectId,
    uploadId
  )
}

export { validateHabitatUpload }
