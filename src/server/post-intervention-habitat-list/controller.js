import { createHabitatListController } from '../common/helpers/habitat-list-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'

export const getController = createHabitatListController(
  HABITAT_UPLOAD_TYPES.postIntervention
)
