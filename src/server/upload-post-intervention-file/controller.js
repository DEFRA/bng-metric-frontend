import { createUploadFileController } from '../common/helpers/habitat-upload-file-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'

export const getController = createUploadFileController(
  HABITAT_UPLOAD_TYPES.postIntervention
)
