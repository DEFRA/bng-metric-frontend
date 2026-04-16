import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'

const logger = createLogger()

const backendUrl = config.get('backend').url.replace(/\/$/, '')

/**
 * Call the backend to validate the uploaded baseline file.
 * @param {string} uploadId - The upload ID to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateBaseline(uploadId) {
  const url = `${backendUrl}/baseline/validate/${uploadId}`

  logger.info(`Validating baseline - uploadId: ${uploadId}`)

  try {
    const { payload } = await Wreck.post(url, { json: true })

    return { valid: payload.valid ?? false }
  } catch (error) {
    const statusCode = error?.output?.statusCode
    const responsePayload = error?.data?.payload
    logger.error(
      `Error validating baseline - uploadId: ${uploadId}, statusCode: ${statusCode}, responsePayload: ${JSON.stringify(responsePayload)}, message: ${error?.message}`
    )
    return {
      valid: false,
      error: responsePayload?.error ?? 'Unable to validate file'
    }
  }
}
