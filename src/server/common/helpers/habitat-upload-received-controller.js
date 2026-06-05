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

function listHref(uploadType, projectId) {
  return `/projects/${projectId}/${uploadType.listRoute}`
}

async function handleReadyUpload(
  request,
  h,
  uploadType,
  validateUpload,
  id,
  uploadId
) {
  const result = await validateUpload(id, uploadId)

  clearUploadSession(request, uploadType)

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

  return h.redirect(listHref(uploadType, id))
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

      const response = await getUploadStatus(uploadId)
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
