import {
  validateBaseline,
  enqueueValidateBaseline
} from '../common/services/baseline.js'
import { createUploadReceivedController } from '../common/helpers/habitat-upload-received-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'

export const getController = createUploadReceivedController(
  HABITAT_UPLOAD_TYPES.baseline,
  {
    validateUpload: validateBaseline,
    enqueueValidation: enqueueValidateBaseline
  }
)
