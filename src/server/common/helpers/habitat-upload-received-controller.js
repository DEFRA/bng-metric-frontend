import { getUploadStatus } from '../services/uploader.js'
import { createLogger } from './logging/logger.js'
import { config } from '../../../config/config.js'

const logger = createLogger()
const REFRESH_INTERVAL_SECONDS = 5
const MAX_WAIT_SECONDS = 120
const MILLISECONDS_PER_SECOND = 1000
const STATUS_READY = 'ready'
const STATUS_REJECTED = 'rejected'
const JOB_STATUS_SUCCEEDED = 'succeeded'
const JOB_STATUS_FAILED = 'failed'

const GPKG_FORMAT_ERROR_CODES = new Set([
  'GPKG_INVALID_FILE',
  'GPKG_NOT_A_GEOPACKAGE'
])
const GPKG_FORMAT_ERROR_MESSAGE =
  'The selected file must be a GeoPackage (.gpkg)'
const TIMEOUT_MESSAGE = 'The file check timed out. Please try again.'
const GENERIC_VALIDATION_MESSAGE = 'Unable to validate file'

function asyncEnabled() {
  return config.get('asyncValidation.enabled')
}

function clearUploadSession(request, uploadType) {
  request.yar.clear(uploadType.pendingUploadSessionKey)
  request.yar.clear(uploadType.uploadStartedAtSessionKey)
}

function clearValidationSession(request, uploadType) {
  request.yar.clear(uploadType.pendingJobIdSessionKey)
  request.yar.clear(uploadType.validationStartedAtSessionKey)
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

function validatingHref(uploadType, projectId) {
  return `/projects/${projectId}/${uploadType.validatingRoute}`
}

function elapsedSeconds(startedAtMs) {
  return (Date.now() - startedAtMs) / MILLISECONDS_PER_SECOND
}

// The shared "Checking your file" meta-refresh screen, used for both the upload
// scan wait and the async validation-job wait.
function checkingView(h, uploadType, id) {
  return h.view('upload-received/upload-received', {
    pageTitle: 'Checking your file',
    heading: 'Checking your file',
    projectId: id,
    backHref: uploadHref(uploadType, id),
    refreshInterval: REFRESH_INTERVAL_SECONDS
  })
}

// Route to the habitat list on success, back to the upload page for a bad-format
// file, or to the dropout page for validation errors. Shared by the synchronous
// path and the async job-polling path so both interpret a result identically.
function applyValidationResult(request, h, uploadType, id, result) {
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

async function handleReadyUploadSync(
  request,
  h,
  uploadType,
  validateUpload,
  id,
  uploadId
) {
  const result = await validateUpload(request, id, uploadId)
  clearUploadSession(request, uploadType)
  return applyValidationResult(request, h, uploadType, id, result)
}

async function handleReadyUploadAsync(
  request,
  h,
  uploadType,
  deps,
  id,
  uploadId
) {
  const outcome = await deps.enqueueValidation(request, id, uploadId)

  // Backend async validation disabled / unreachable: fall back to the
  // synchronous route so the journey still completes.
  if (outcome.unavailable) {
    return handleReadyUploadSync(
      request,
      h,
      uploadType,
      deps.validateUpload,
      id,
      uploadId
    )
  }

  clearUploadSession(request, uploadType)

  if (outcome.pending) {
    request.yar.set(uploadType.pendingJobIdSessionKey, outcome.jobId)
    request.yar.set(uploadType.validationStartedAtSessionKey, Date.now())
    return h.redirect(validatingHref(uploadType, id))
  }

  // Fast file: the backend returned the result inline within its hold-open
  // window, so there is nothing to poll.
  return applyValidationResult(request, h, uploadType, id, outcome)
}

async function handleReadyUpload(request, h, uploadType, deps, id, uploadId) {
  if (asyncEnabled() && deps.enqueueValidation) {
    return handleReadyUploadAsync(request, h, uploadType, deps, id, uploadId)
  }
  return handleReadyUploadSync(
    request,
    h,
    uploadType,
    deps.validateUpload,
    id,
    uploadId
  )
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
  const elapsed = elapsedSeconds(uploadStartedAt(request, uploadType))

  if (elapsed > MAX_WAIT_SECONDS) {
    clearUploadSession(request, uploadType)
    request.yar.set(uploadType.uploadErrorSessionKey, TIMEOUT_MESSAGE)
    return h.redirect(uploadHref(uploadType, id))
  }

  return checkingView(h, uploadType, id)
}

// deps is { validateUpload, enqueueValidation? }. A bare validate function is
// still accepted for back-compatibility.
function createUploadReceivedController(uploadType, deps) {
  const resolvedDeps =
    typeof deps === 'function' ? { validateUpload: deps } : deps

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
          resolvedDeps,
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

// A failed job carries either structured validation errors (in result) or a
// single error message; present both as a validation-result shape.
function jobFailureResult(job) {
  const hasErrors =
    Array.isArray(job.result?.errors) && job.result.errors.length > 0
  const errors = hasErrors
    ? job.result.errors
    : [
        {
          code: 'VALIDATION_FAILED',
          message: job.error ?? GENERIC_VALIDATION_MESSAGE
        }
      ]
  return { valid: false, errors }
}

function handleValidatingWait(request, h, uploadType, id) {
  const startedAt =
    request.yar.get(uploadType.validationStartedAtSessionKey) || Date.now()

  if (elapsedSeconds(startedAt) > MAX_WAIT_SECONDS) {
    clearValidationSession(request, uploadType)
    request.yar.set(uploadType.uploadErrorSessionKey, TIMEOUT_MESSAGE)
    return h.redirect(uploadHref(uploadType, id))
  }

  return checkingView(h, uploadType, id)
}

// Polls the backend validation job (one GET per meta-refresh tick) and, on a
// terminal status, hands off to the shared result handler. Until then it
// re-renders the "Checking your file" screen within the same deadline budget.
function createValidationInProgressController(uploadType, getJobStatus) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const jobId = request.yar.get(uploadType.pendingJobIdSessionKey)

      if (!jobId) {
        return h.redirect(uploadHref(uploadType, id))
      }

      const job = await getJobStatus(request, jobId)

      logger.info(
        `${uploadType.validatingRoute} - jobId: ${jobId}, status: ${job.status}`
      )

      if (job.status === JOB_STATUS_SUCCEEDED) {
        clearValidationSession(request, uploadType)
        const result = job.result ?? { valid: false, errors: [] }
        return applyValidationResult(request, h, uploadType, id, result)
      }

      if (job.status === JOB_STATUS_FAILED) {
        clearValidationSession(request, uploadType)
        return applyValidationResult(
          request,
          h,
          uploadType,
          id,
          jobFailureResult(job)
        )
      }

      return handleValidatingWait(request, h, uploadType, id)
    }
  }
}

export { createUploadReceivedController, createValidationInProgressController }
