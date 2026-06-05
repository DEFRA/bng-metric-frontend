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

function createUploadReceivedController(uploadType, validateUpload) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const uploadId = request.yar.get(uploadType.pendingUploadSessionKey)

      logger.info(
        `${uploadType.uploadReceivedRoute} - projectId: ${id}, pendingUploadId: ${uploadId}`
      )

      if (!uploadId) {
        return h.redirect(`/projects/${id}/${uploadType.uploadRoute}`)
      }

      const response = await getUploadStatus(uploadId)
      const uploadStatus = response.uploadStatus

      logger.info(
        `${uploadType.uploadReceivedRoute} - uploadId: ${uploadId}, uploadStatus: ${uploadStatus}`
      )

      if (uploadStatus === STATUS_READY) {
        const result = await validateUpload(id, uploadId)

        request.yar.clear(uploadType.pendingUploadSessionKey)
        request.yar.clear(uploadType.uploadStartedAtSessionKey)

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
            return h.redirect(`/projects/${id}/${uploadType.uploadRoute}`)
          }

          request.yar.set(uploadType.validationErrorsSessionKey, errors)
          request.yar.set(uploadType.validationErrorsProjectIdSessionKey, id)
          request.yar.set(
            uploadType.validationUploadTypeSessionKey,
            uploadType.key
          )
          return h.redirect('/error-file')
        }

        return h.redirect(`/projects/${id}/${uploadType.listRoute}`)
      }

      if (uploadStatus === STATUS_REJECTED) {
        request.yar.clear(uploadType.pendingUploadSessionKey)
        request.yar.clear(uploadType.uploadStartedAtSessionKey)
        request.yar.set(uploadType.validationErrorsSessionKey, [])
        request.yar.set(uploadType.validationErrorsProjectIdSessionKey, id)
        request.yar.set(
          uploadType.validationUploadTypeSessionKey,
          uploadType.key
        )
        return h.redirect('/error-file')
      }

      const startedAt =
        request.yar.get(uploadType.uploadStartedAtSessionKey) || Date.now()

      if (!request.yar.get(uploadType.uploadStartedAtSessionKey)) {
        request.yar.set(uploadType.uploadStartedAtSessionKey, startedAt)
      }

      const elapsed = (Date.now() - startedAt) / 1000

      if (elapsed > MAX_WAIT_SECONDS) {
        request.yar.clear(uploadType.pendingUploadSessionKey)
        request.yar.clear(uploadType.uploadStartedAtSessionKey)
        request.yar.set(
          uploadType.uploadErrorSessionKey,
          'The file check timed out. Please try again.'
        )
        return h.redirect(`/projects/${id}/${uploadType.uploadRoute}`)
      }

      return h.view('upload-received/upload-received', {
        pageTitle: 'Checking your file',
        heading: 'Checking your file',
        projectId: id,
        backHref: `/projects/${id}/${uploadType.uploadRoute}`,
        refreshInterval: REFRESH_INTERVAL_SECONDS
      })
    }
  }
}

export { createUploadReceivedController }
