import Boom from '@hapi/boom'
import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'

const logger = createLogger()

const backendUrl = config.get('backend').url

/**
 * Prepend the CDP uploader base URL for local development.
 * In CDP cloud, the platform proxy handles routing so the path is used as-is.
 * @param {string} path - Upload path from the backend
 * @returns {string}
 */
function buildUploadUrl(path) {
  const cdpUploaderUrl = config.get('cdpUploader.url')

  if (!cdpUploaderUrl || path.startsWith('http')) {
    return path
  }

  return `${cdpUploaderUrl}${path}`
}

/**
 * Initiate an upload session via the backend
 * @param {object} options - Upload options
 * @param {string} options.redirect - URL to redirect to after upload
 * @param {string} options.s3Bucket - Destination S3 bucket
 * @param {string} [options.s3Path] - Optional path within the bucket
 * @param {object} [options.metadata] - Optional metadata
 * @returns {Promise<{uploadId: string, uploadUrl: string}>}
 * @throws {Boom} badGateway if the backend is unreachable or returns an error
 */
export async function initiateUpload({ redirect, s3Bucket, s3Path, metadata }) {
  const url = `${backendUrl}/upload/initiate`

  logger.info(
    `Initiating upload - url: ${url}, s3Bucket: ${s3Bucket}, s3Path: ${s3Path}`
  )

  try {
    const { payload } = await Wreck.post(url, {
      payload: JSON.stringify({
        redirect,
        s3Bucket,
        s3Path,
        metadata
      }),
      headers: {
        'Content-Type': 'application/json'
      },
      json: true
    })

    const uploadUrl = buildUploadUrl(payload.uploadUrl)
    logger.info(
      `Upload initiated - uploadId: ${payload.uploadId}, raw uploadUrl: ${payload.uploadUrl}, resolved uploadUrl: ${uploadUrl}`
    )
    return {
      uploadId: payload.uploadId,
      uploadUrl
    }
  } catch (error) {
    const statusCode = error?.output?.statusCode
    const responsePayload = error?.data?.payload

    logger.error(
      `Error initiating upload - url: ${url}, backendUrl: ${backendUrl}, s3Bucket: ${s3Bucket}, s3Path: ${s3Path}, statusCode: ${statusCode}, responsePayload: ${JSON.stringify(responsePayload)}, message: ${error?.message}`
    )

    throw Boom.badGateway('Unable to initiate upload', error)
  }
}

/**
 * Get the upload status from the backend
 * @param {string} uploadId - The upload ID to check status for
 * @returns {Promise<{uploadStatus: string, error?: string}>}
 */
export async function getUploadStatus(uploadId) {
  const url = `${backendUrl}/upload/${uploadId}/status`

  logger.info(`Fetching upload status - url: ${url}, uploadId: ${uploadId}`)

  try {
    const { payload } = await Wreck.get(url, { json: true })

    if (payload.numberOfRejectedFiles > 0) {
      logger.info(
        `Upload rejected - uploadId: ${uploadId}, numberOfRejectedFiles: ${payload.numberOfRejectedFiles}, errorMessage: ${payload.errorMessage}`
      )
      return {
        uploadStatus: 'rejected',
        errorMessage: payload.errorMessage
      }
    }

    return {
      uploadStatus: payload.uploadStatus ?? 'unknown'
    }
  } catch (error) {
    const statusCode = error?.output?.statusCode
    const responsePayload = error?.data?.payload

    logger.error(
      `Error fetching upload status - url: ${url}, backendUrl: ${backendUrl}, uploadId: ${uploadId}, statusCode: ${statusCode}, responsePayload: ${JSON.stringify(responsePayload)}, message: ${error?.message}`
    )

    // Return an error status rather than throwing Boom — the caller retries
    // via meta-refresh and the timeout mechanism will handle persistent failures
    return {
      uploadStatus: 'error',
      error: 'Unable to check upload status'
    }
  }
}
