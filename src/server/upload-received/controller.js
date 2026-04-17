import { getUploadStatus } from '../common/services/uploader.js'
import { validateBaseline } from '../common/services/baseline.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()
const REFRESH_INTERVAL_SECONDS = 5
const STATUS_READY = 'ready'
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

    if (uploadStatus === STATUS_REJECTED) {
      request.yar.clear('pendingUploadId')
      request.yar.set('baselineError', 'The selected file contains a virus')
      return h.redirect(`/projects/${id}/upload-baseline-file`)
    }

    return h.view('upload-received/upload-received', {
      pageTitle: 'Checking your file',
      heading: 'Checking your file',
      projectId: id,
      refreshInterval: REFRESH_INTERVAL_SECONDS
    })
  }
}
