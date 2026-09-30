import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { AREA_POST_INTERVENTION_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const areaPostIntervention = createProjectGetPlugin({
  name: 'area-post-intervention',
  path: AREA_POST_INTERVENTION_PATH,
  getController
})
