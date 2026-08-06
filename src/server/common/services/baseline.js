import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { createLogger } from '../helpers/logging/logger.js'
import { backendRequest } from '../helpers/auth/backend-request.js'
import { HABITAT_UPLOAD_TYPES } from '../helpers/habitat-upload-types.js'

const logger = createLogger()

const backendUrl = config.get('backend').url

async function validateHabitatUpload(request, uploadType, projectId, uploadId) {
  const url = `${backendUrl}/${uploadType.backendValidatePath}/validate/${uploadId}`

  logger.info(
    `Validating ${uploadType.label} habitats - url: ${url}, projectId: ${projectId}, uploadId: ${uploadId}`
  )

  try {
    const { payload } = await backendRequest(request, 'post', url, {
      payload: JSON.stringify({ projectId }),
      headers: { 'Content-Type': 'application/json' }
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
 * @returns {Promise<{valid: boolean, errors?: object[]}>}
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

const HTTP_ACCEPTED = 202

/**
 * Enqueue a habitat file for asynchronous validation on the backend. The backend
 * either returns the result inline (200, small files that finished inside its
 * hold-open window) or accepts the job for background processing (202 + a job
 * id) which the caller then polls via {@link getValidationJobStatus}.
 *
 * @returns {Promise<{pending?: boolean, jobId?: string, valid?: boolean, errors?: object[], unavailable?: boolean}>}
 *   - `{ pending, jobId }` when the job is running (poll the status route)
 *   - `{ valid, errors }` when the result came back inline
 *   - `{ unavailable: true }` when async validation is off/unreachable on the
 *     backend, signalling the caller to fall back to the synchronous route
 */
async function enqueueHabitatValidation(
  request,
  uploadType,
  projectId,
  uploadId
) {
  const url = `${backendUrl}/${uploadType.backendValidatePath}/validate-async/${uploadId}`

  logger.info(
    `Enqueuing ${uploadType.label} validation - url: ${url}, projectId: ${projectId}, uploadId: ${uploadId}`
  )

  try {
    const { res, payload } = await backendRequest(request, 'post', url, {
      payload: JSON.stringify({ projectId }),
      headers: { 'Content-Type': 'application/json' }
    })

    if (res.statusCode === HTTP_ACCEPTED) {
      return { pending: true, jobId: payload.jobId }
    }

    if (res.statusCode === statusCodes.ok) {
      const errors = Array.isArray(payload.errors) ? payload.errors : []
      return payload.valid ? { valid: true } : { valid: false, errors }
    }

    // e.g. 503 when the backend worker is disabled — let the caller fall back.
    logger.info(
      `${uploadType.label} enqueue returned ${res.statusCode}; falling back to synchronous validation`
    )
    return { unavailable: true }
  } catch (error) {
    logger.error(
      `Error enqueuing ${uploadType.label} validation - uploadId: ${uploadId}, message: ${error?.message}`
    )
    return { unavailable: true }
  }
}

/**
 * Poll the status of a validation job. Transient errors resolve to a 'pending'
 * status so the polling screen keeps retrying within its deadline rather than
 * dropping out.
 *
 * @returns {Promise<{status: string, statusCode?: number, result?: object, error?: string}>}
 */
async function getValidationJobStatus(request, jobId) {
  const url = `${backendUrl}/baseline/jobs/${jobId}`

  try {
    const { res, payload } = await backendRequest(request, 'get', url)

    if (res.statusCode === statusCodes.ok) {
      return payload
    }
    if (res.statusCode === statusCodes.notFound) {
      return { status: 'failed', error: 'Validation job not found' }
    }
    return { status: 'pending' }
  } catch (error) {
    logger.error(
      `Error fetching validation job ${jobId} - message: ${error?.message}`
    )
    return { status: 'pending' }
  }
}

export async function enqueueValidateBaseline(request, projectId, uploadId) {
  return enqueueHabitatValidation(
    request,
    HABITAT_UPLOAD_TYPES.baseline,
    projectId,
    uploadId
  )
}

export async function enqueueValidatePostIntervention(
  request,
  projectId,
  uploadId
) {
  return enqueueHabitatValidation(
    request,
    HABITAT_UPLOAD_TYPES.postIntervention,
    projectId,
    uploadId
  )
}

export { enqueueHabitatValidation, getValidationJobStatus }
