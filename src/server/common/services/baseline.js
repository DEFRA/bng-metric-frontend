import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { createLogger } from '../helpers/logging/logger.js'
import { backendRequest } from '../helpers/auth/backend-request.js'
import { HABITAT_UPLOAD_TYPES } from '../helpers/habitat-upload-types.js'
import { describeBackendFailure } from '../helpers/backend-failure.js'
import { isRateLimited, retryAfterSeconds } from '../helpers/rate-limited.js'

const logger = createLogger()

const backendUrl = config.get('backend').url

/**
 * Bounds applied to a `Retry-After` we are told to honour.
 *
 * The header comes from another service, so it is treated as a hint rather than
 * an instruction: too small and a saturated backend gets hammered by every
 * waiting browser, too large and the user stares at a spinner long past the
 * point the service recovered. Anything over it, or unparseable, falls back to
 * the caller's own default (retryAfterSeconds in rate-limited.js).
 */
const MAX_RETRY_AFTER_SECONDS = 30

/** The backend's code for "the pool was full, your file was never looked at". */
const VALIDATION_BUSY_CODE = 'VALIDATION_BUSY'

/**
 * Is this the backend telling us every validation worker was busy?
 *
 * The status code alone cannot answer that. A 503 is also what the platform
 * returns when there is no healthy backend to reach at all, and reading one of
 * those as "busy" would park the user on the "Checking your file" page,
 * politely retrying, for the full two minutes while the service is actually
 * down. The body is what separates them: only our own backend sends
 * VALIDATION_BUSY, and it sends it on exactly this path.
 *
 * Anything else wearing a 503 therefore falls through to the error handling
 * below, which is the honest answer for an unreachable service.
 *
 * @param {number} statusCode
 * @param {object} [payload] parsed response body, when the body was JSON
 */
function isValidationBusy(statusCode, payload) {
  return (
    statusCode === statusCodes.serviceUnavailable &&
    Array.isArray(payload?.errors) &&
    payload.errors.some((error) => error?.code === VALIDATION_BUSY_CODE)
  )
}

async function validateHabitatUpload(request, uploadType, projectId, uploadId) {
  const url = `${backendUrl}/${uploadType.backendValidatePath}/validate/${uploadId}`

  logger.info(
    `Validating ${uploadType.label} habitats - url: ${url}, projectId: ${projectId}, uploadId: ${uploadId}`
  )

  // Overrides the short default every other backend call uses. Validation is
  // the one call that legitimately takes seconds.
  const timeoutMs = config.get('backend').validateTimeoutMs
  const startedAt = performance.now()

  try {
    const { payload } = await backendRequest(request, 'post', url, {
      payload: JSON.stringify({ projectId }),
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs
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
    // A rate limit refused the call: not a backend failure and not a problem
    // with the file. It is answered as busy, so the "Checking your file" page
    // waits and asks again, as it does for a busy validator and for a refused
    // status check, inside the same two-minute bound. The likeliest cause is
    // the all-users limit filling while the service is under load, which is
    // exactly when the user should be kept waiting rather than sent away.
    if (isRateLimited(error)) {
      const retryAfter =
        error.data.retryAfterSeconds === null
          ? null
          : Math.min(error.data.retryAfterSeconds, MAX_RETRY_AFTER_SECONDS)
      logger.info(
        `${uploadType.label} habitat validation refused by the backend's rate limit, waiting as busy - uploadId: ${uploadId}, retryAfter: ${retryAfter ?? 'unset'}`
      )
      return {
        valid: false,
        busy: true,
        retryAfterSeconds: retryAfter,
        errors: []
      }
    }

    const statusCode = error?.output?.statusCode
    const responsePayload = error?.data?.payload

    // The status code alone is ambiguous — wreck gives its own timeout a 504
    // and a dropped connection a 502 — so say which failure this was, how long
    // it took and what answered, so the cause of a 502 can be read off the log.
    // It gives only the safe fields of the backend's body, never its messages.
    const failure = describeBackendFailure(error, {
      elapsedMs: performance.now() - startedAt,
      timeoutMs
    })
    logger.error(
      `Error validating ${uploadType.label} habitats - uploadId: ${uploadId}, statusCode: ${statusCode}, ${failure}, message: ${error?.message}`
    )

    // A busy validator means the file was never looked at. It is the one
    // backend failure that is NOT about the user's file, so it must not reach
    // the "there is a problem with your file" screen — the answer is simply to
    // try again in a moment.
    if (isValidationBusy(statusCode, responsePayload)) {
      // The backend decides the pace, because it is the side that knows how
      // loaded it is. Null here just means "use your own default".
      const retryAfter = retryAfterSeconds(error?.data?.res?.headers, {
        max: MAX_RETRY_AFTER_SECONDS
      })
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
