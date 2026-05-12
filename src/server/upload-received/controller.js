import { getUploadStatus } from '../common/services/uploader.js'
import { validateBaseline } from '../common/services/baseline.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()
const REFRESH_INTERVAL_SECONDS = 5
const MAX_WAIT_SECONDS = 120
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
      const result = await validateBaseline(id, uploadId)

      request.yar.clear('pendingUploadId')
      request.yar.clear('uploadStartedAt')

      if (!result.valid) {
        // Structured errors are handed to the BMD-367 dropout page via session.
        request.yar.set('baselineValidationErrors', result.errors ?? [])
        // The dropout page is project-agnostic; pass the projectId so it can
        // render a "try another file" link back to the upload page.
        request.yar.set('baselineValidationErrorsProjectId', id)
        return h.redirect('/invalid-file')
      }

      return h.redirect(`/projects/${id}/upload-result`)
    }

    if (uploadStatus === STATUS_REJECTED) {
      request.yar.clear('pendingUploadId')
      request.yar.clear('uploadStartedAt')
      request.yar.set('baselineValidationErrors', [])
      request.yar.set('baselineValidationErrorsProjectId', id)
      return h.redirect('/invalid-file')
    }

    // Track when polling started. If we exceed the max wait time, redirect
    // to an error page (which has no meta-refresh) instead of rendering the
    // refresh page again — this breaks the polling loop.
    const startedAt = request.yar.get('uploadStartedAt') || Date.now()

    if (!request.yar.get('uploadStartedAt')) {
      request.yar.set('uploadStartedAt', startedAt)
    }

    const elapsed = (Date.now() - startedAt) / 1000

    if (elapsed > MAX_WAIT_SECONDS) {
      request.yar.clear('pendingUploadId')
      request.yar.clear('uploadStartedAt')
      request.yar.set(
        'uploadError',
        'The file check timed out. Please try again.'
      )
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
