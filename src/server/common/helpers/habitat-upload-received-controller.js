import { getUploadStatus } from '../services/uploader.js'
import { createLogger } from './logging/logger.js'

const logger = createLogger()
const REFRESH_INTERVAL_SECONDS = 5
const MAX_WAIT_SECONDS = 120
const STATUS_READY = 'ready'
const STATUS_REJECTED = 'rejected'

const GPKG_FORMAT_ERROR_CODES = new Set([
  'GPKG_INVALID_FILE',
  'GPKG_NOT_A_GEOPACKAGE'
])
const GPKG_FORMAT_ERROR_MESSAGE =
  'The selected file must be a GeoPackage (.gpkg)'

/**
 * Shown when the backend refuses the upload because every geometry-validation
 * worker is busy. Deliberately says nothing about the file: there is nothing
 * wrong with it and nothing for the user to change, so the message has to avoid
 * sending them off to re-draw perfectly good polygons.
 */
const SERVICE_BUSY_MESSAGE =
  'The service is busy checking other files. Please try again in a few moments.'

function clearUploadSession(request, uploadType) {
  request.yar.clear(uploadType.pendingUploadSessionKey)
  request.yar.clear(uploadType.uploadStartedAtSessionKey)
}

function storeValidationErrors(request, uploadType, projectId, errors) {
  request.yar.set(uploadType.validationErrorsSessionKey, errors)
  request.yar.set(uploadType.validationErrorsProjectIdSessionKey, projectId)
  request.yar.set(uploadType.validationUploadTypeSessionKey, uploadType.key)
}

function uploadHref(uploadType, projectId) {
  return `/projects/${projectId}/${uploadType.uploadRoute}`
}

function successHref(uploadType, projectId) {
  return `/projects/${projectId}/${uploadType.successRoute ?? uploadType.listRoute}`
}

async function handleReadyUpload(
  request,
  h,
  uploadType,
  validateUpload,
  id,
  uploadId
) {
  const result = await validateUpload(request, id, uploadId)

  clearUploadSession(request, uploadType)

  // Capacity, not a bad file. Send them back to the upload page with a retry
  // prompt rather than to the file-problem page — same treatment the upload
  // timeout already gets, because the user's next action is the same: try again.
  if (result.busy) {
    request.yar.set(uploadType.uploadErrorSessionKey, SERVICE_BUSY_MESSAGE)
    return h.redirect(uploadHref(uploadType, id))
  }

  if (!result.valid) {
    const errors = result.errors ?? []
    const isFormatError = errors.some((e) =>
      GPKG_FORMAT_ERROR_CODES.has(e?.code)
    )

    if (isFormatError) {
      request.yar.set(
        uploadType.uploadErrorSessionKey,
        GPKG_FORMAT_ERROR_MESSAGE
      )
      return h.redirect(uploadHref(uploadType, id))
    }

    storeValidationErrors(request, uploadType, id, errors)
    return h.redirect('/error-file')
  }

  return h.redirect(successHref(uploadType, id))
}

function handleRejectedUpload(request, h, uploadType, id) {
  clearUploadSession(request, uploadType)
  storeValidationErrors(request, uploadType, id, [])
  return h.redirect('/error-file')
}

function uploadStartedAt(request, uploadType) {
  const startedAt =
    request.yar.get(uploadType.uploadStartedAtSessionKey) || Date.now()

  if (!request.yar.get(uploadType.uploadStartedAtSessionKey)) {
    request.yar.set(uploadType.uploadStartedAtSessionKey, startedAt)
  }

  return startedAt
}

function handleWaitingUpload(request, h, uploadType, id) {
  const elapsed = (Date.now() - uploadStartedAt(request, uploadType)) / 1000

  if (elapsed > MAX_WAIT_SECONDS) {
    clearUploadSession(request, uploadType)
    request.yar.set(
      uploadType.uploadErrorSessionKey,
      'The file check timed out. Please try again.'
    )
    return h.redirect(uploadHref(uploadType, id))
  }

  return h.view('upload-received/upload-received', {
    pageTitle: 'Checking your file',
    heading: 'Checking your file',
    projectId: id,
    backHref: uploadHref(uploadType, id),
    refreshInterval: REFRESH_INTERVAL_SECONDS
  })
}

function createUploadReceivedController(uploadType, validateUpload) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const uploadId = request.yar.get(uploadType.pendingUploadSessionKey)

      logger.info(
        `${uploadType.uploadReceivedRoute} - projectId: ${id}, pendingUploadId: ${uploadId}`
      )

      if (!uploadId) {
        return h.redirect(uploadHref(uploadType, id))
      }

      const response = await getUploadStatus(request, uploadId)
      const uploadStatus = response.uploadStatus

      logger.info(
        `${uploadType.uploadReceivedRoute} - uploadId: ${uploadId}, uploadStatus: ${uploadStatus}`
      )

      if (uploadStatus === STATUS_READY) {
        return handleReadyUpload(
          request,
          h,
          uploadType,
          validateUpload,
          id,
          uploadId
        )
      }

      if (uploadStatus === STATUS_REJECTED) {
        return handleRejectedUpload(request, h, uploadType, id)
      }

      return handleWaitingUpload(request, h, uploadType, id)
    }
  }
}

export { createUploadReceivedController }
