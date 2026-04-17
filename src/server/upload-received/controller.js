import { getUploadStatus } from '../common/services/uploader.js'
import { validateBaseline } from '../common/services/baseline.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()
const REFRESH_INTERVAL_SECONDS = 5
const STATUS_PENDING = 'pending'
const STATUS_READY = 'ready'
const STATUS_INITIATED = 'initiated'
const STATUS_REJECTED = 'rejected'

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const uploadId = request.yar.get('pendingUploadId')

    logger.info(
      `upload-received - projectId: ${id}, pendingUploadId: ${uploadId}`
    )

    if (!uploadId) {
      return h.redirect(`/projects/${id}/upload-baseline-file`)
    }

    const response = await getUploadStatus(uploadId)
    const uploadStatus = response.uploadStatus

    logger.info(
      `upload-received - uploadId: ${uploadId}, uploadStatus: ${uploadStatus}`
    )

    if (uploadStatus === STATUS_READY) {
      const result = await validateBaseline(uploadId)

      request.yar.clear('pendingUploadId')

      if (result.error) {
        request.yar.set('baselineError', result.error)
        return h.redirect(`/projects/${id}/upload-baseline-file`)
      }

      return h.redirect(`/projects/${id}/upload-result`)
    }

    const isProcessing =
      uploadStatus === STATUS_PENDING || uploadStatus === STATUS_INITIATED

    const isVirusError = uploadStatus === STATUS_REJECTED
    const errorMessage = isVirusError
      ? 'The selected file contains a virus'
      : response.error || null

    if (errorMessage) {
      request.yar.clear('pendingUploadId')
    }

    return h.view('upload-received/upload-received', {
      pageTitle: isProcessing ? 'Checking your file' : 'There is a problem',
      heading: isProcessing ? 'Checking your file' : 'There is a problem',
      projectId: id,
      status: uploadStatus,
      isProcessing,
      refreshInterval: isProcessing ? REFRESH_INTERVAL_SECONDS : null,
      errorMessage
    })
  }
}
