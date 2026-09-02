import { getUploadStatus } from '../services/uploader.js'
import { createLogger } from './logging/logger.js'

const logger = createLogger()
const REFRESH_INTERVAL_SECONDS = 5

/**
 * Seconds of jitter added to the refresh interval when we are waiting on a busy
 * validator. Without it every waiting browser retries in lockstep, so the pool
 * sees a burst every five seconds and idles in between — the worst possible
 * arrival pattern for a small fixed pool.
 */
const REFRESH_JITTER_SECONDS = 3
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
 * Shown once we give up waiting for a busy validator — see MAX_WAIT_SECONDS.
 * Deliberately says nothing about the file: there is nothing wrong with it and
 * nothing for the user to change, so the message must not send them off to
 * re-draw perfectly good polygons.
 */
const SERVICE_BUSY_MESSAGE =
  'The service is busy checking other files. Please try again in a few moments.'

/**
 * A refresh interval that will not put every waiting browser in lockstep.
 *
 * `baseSeconds` lets the backend set the pace via `Retry-After` — it is the side
 * that knows how loaded it is — while the jitter stays on this side, because
 * spreading clients out is a client-side concern. Falls back to the standard
 * interval when the backend has not said.
 */
function jitteredRefreshInterval(baseSeconds = REFRESH_INTERVAL_SECONDS) {
  return baseSeconds + Math.random() * REFRESH_JITTER_SECONDS
}

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

  // Capacity, not a bad file — the backend never looked at it. Keep the user on
  // the "Checking your file" page and let its meta-refresh try again, exactly as
  // it already does while the uploader is still working. Handled BEFORE the
  // session is cleared, because the retry needs the uploadId that lives in it.
  if (result.busy) {
    return waitForCapacity(request, h, uploadType, id, result.retryAfterSeconds)
  }

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

  return h.redirect(successHref(uploadType, id))
}

/**
 * Hold the user on the polling page while the validator is saturated.
 *
 * The refresh loop IS the queue. Bouncing a request the backend cannot take is
 * cheap — it refuses before downloading the file — so retrying every few seconds
 * costs far less than holding a connection open, and it degrades gracefully:
 * everyone waits a little longer rather than some requests failing outright.
 *
 * Bounded by the same MAX_WAIT_SECONDS the uploader wait uses. A service that
 * has been too busy for two minutes is not going to be free in another five
 * seconds, and polling forever would be worse than saying so.
 */
function waitForCapacity(request, h, uploadType, id, retryAfterSeconds) {
  const elapsed = (Date.now() - uploadStartedAt(request, uploadType)) / 1000

  if (elapsed > MAX_WAIT_SECONDS) {
    clearUploadSession(request, uploadType)
    request.yar.set(uploadType.uploadErrorSessionKey, SERVICE_BUSY_MESSAGE)
    return h.redirect(uploadHref(uploadType, id))
  }

  return h.view('upload-received/upload-received', {
    pageTitle: 'Checking your file',
    heading: 'Checking your file',
    projectId: id,
    backHref: uploadHref(uploadType, id),
    refreshInterval: jitteredRefreshInterval(retryAfterSeconds ?? undefined)
  })
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
    refreshInterval: jitteredRefreshInterval()
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
