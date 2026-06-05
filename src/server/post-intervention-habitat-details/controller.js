import { createHabitatDetailsControllers } from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'

const { getController, postController } = createHabitatDetailsControllers(
  HABITAT_UPLOAD_TYPES.postIntervention
)

export { getController, postController }
