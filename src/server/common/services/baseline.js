import Boom from '@hapi/boom'

import { backendClient } from './backend-client.js'
import { createLogger } from '../helpers/logging/logger.js'

const logger = createLogger()

/**
 * Call the backend to validate the uploaded baseline file.
 * @param {object} request - The Hapi request, used to derive the signed user-context header
 * @param {string} uploadId - The upload ID to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateBaseline(request, uploadId) {
  logger.info(`Validating baseline - uploadId: ${uploadId}`)

  try {
    const { payload } = await backendClient(request).post(
      `/baseline/validate/${uploadId}`,
      { json: true }
    )

    return { valid: payload.valid ?? false }
  } catch (error) {
    const statusCode = error?.output?.statusCode
    const responsePayload = error?.data?.payload

    logger.error(
      `Error validating baseline - uploadId: ${uploadId}, statusCode: ${statusCode}, responsePayload: ${JSON.stringify(responsePayload)}, message: ${error?.message}`
    )

    if (statusCode >= 400 && statusCode < 500) {
      return {
        valid: false,
        error: responsePayload?.error ?? 'Unable to validate file'
      }
    }

    throw Boom.badGateway('Unable to validate file', error)
  }
}
