import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'

const logger = createLogger()

const backendUrl = config.get('backend').url

/**
 * Call the backend to validate the uploaded baseline file.
 *
 * Returns the structured error array when validation fails, so the
 * controller can hand the detail to the dropout page (BMD-367).
 *
 * @param {string} uploadId - The upload ID to validate
 * @returns {Promise<{valid: boolean, errors?: object[]}>}
 */
export async function validateBaseline(uploadId) {
  const url = `${backendUrl}/baseline/validate/${uploadId}`

  logger.info(`Validating baseline - url: ${url}, uploadId: ${uploadId}`)

  try {
    const { payload } = await Wreck.post(url, { json: true })

    if (!payload.valid) {
      const errors = Array.isArray(payload.errors) ? payload.errors : []
      logger.info(
        `Baseline validation failed - uploadId: ${uploadId}, errorCount: ${errors.length}, codes: ${errors.map((e) => e.code).join(',')}`
      )
      return { valid: false, errors }
    }

    return { valid: true }
  } catch (error) {
    const statusCode = error?.output?.statusCode
    const responsePayload = error?.data?.payload

    logger.error(
      `Error validating baseline - uploadId: ${uploadId}, statusCode: ${statusCode}, responsePayload: ${JSON.stringify(responsePayload)}, message: ${error?.message}`
    )

    // Client errors from the backend indicate a validation problem —
    // surface the structured errors if present.
    if (statusCode >= 400 && statusCode < 500) {
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
