import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { createLogger } from '../helpers/logging/logger.js'
import { wreck } from '../helpers/wreck-client.js'
import { HABITAT_UPLOAD_TYPES } from '../helpers/habitat-upload-types.js'

const logger = createLogger()

const backendUrl = config.get('backend').url

async function validateHabitatUpload(uploadType, projectId, uploadId) {
  const url = `${backendUrl}/${uploadType.backendValidatePath}/validate/${uploadId}`

  logger.info(
    `Validating ${uploadType.label} habitats - url: ${url}, projectId: ${projectId}, uploadId: ${uploadId}`
  )

  try {
    const { payload } = await wreck.post(url, {
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
 * @param {string} projectId - The project to persist the baseline against
 * @param {string} uploadId - The upload ID to validate
 * @returns {Promise<{valid: boolean, errors?: object[]}>}
 */
export async function validateBaseline(projectId, uploadId) {
  return validateHabitatUpload(
    HABITAT_UPLOAD_TYPES.baseline,
    projectId,
    uploadId
  )
}

/**
 * Call the backend to validate an uploaded post-intervention habitats file.
 *
 * @param {string} projectId - The project to persist the post-intervention data against
 * @param {string} uploadId - The upload ID to validate
 * @returns {Promise<{valid: boolean, errors?: object[]}>}
 */
export async function validatePostIntervention(projectId, uploadId) {
  return validateHabitatUpload(
    HABITAT_UPLOAD_TYPES.postIntervention,
    projectId,
    uploadId
  )
}

export { validateHabitatUpload }
