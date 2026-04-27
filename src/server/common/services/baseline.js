import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'

const logger = createLogger()

const backendUrl = config.get('backend').url

/**
 * Call the backend to validate the uploaded baseline file.
 * @param {string} uploadId - The upload ID to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateBaseline(uploadId) {
  const url = `${backendUrl}/baseline/validate/${uploadId}`

  logger.info(`Validating baseline - url: ${url}, uploadId: ${uploadId}`)

  try {
    const { payload } = await Wreck.post(url, { json: true })

    if (!payload.valid) {
      const errorMessage =
        payload.errors?.join(', ') ?? 'Unable to validate file'
      logger.info(
        `Baseline validation failed - uploadId: ${uploadId}, errors: ${errorMessage}`
      )
      return { valid: false, error: errorMessage }
    }

    return { valid: true }
  } catch (error) {
    const statusCode = error?.output?.statusCode
    const responsePayload = error?.data?.payload

    logger.error(
      `Error validating baseline - uploadId: ${uploadId}, statusCode: ${statusCode}, responsePayload: ${JSON.stringify(responsePayload)}, message: ${error?.message}`
    )

    // Client errors from the backend indicate a validation problem —
    // return the error message so the caller can show it to the user
    if (statusCode >= 400 && statusCode < 500) {
      return {
        valid: false,
        error: responsePayload?.error ?? 'Unable to validate file'
      }
    }

    // Server or network errors — throw a Boom error so Hapi handles
    // the response with the appropriate HTTP status code
    throw Boom.badGateway('Unable to validate file', error)
  }
}
