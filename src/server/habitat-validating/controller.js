import { getValidationJobStatus } from '../common/services/baseline.js'
import { createValidationInProgressController } from '../common/helpers/habitat-upload-received-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'

// The "Checking your file" polling screens for asynchronous validation. Each GET
// is one poll tick: it reads the pending job id from the session, asks the
// backend for the job status, and either re-renders the wait screen or redirects
// to the habitat list / dropout page once the job is terminal.
export const baselineValidatingController =
  createValidationInProgressController(
    HABITAT_UPLOAD_TYPES.baseline,
    getValidationJobStatus
  )

export const postInterventionValidatingController =
  createValidationInProgressController(
    HABITAT_UPLOAD_TYPES.postIntervention,
    getValidationJobStatus
  )
