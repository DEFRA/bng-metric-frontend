import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { WATERCOURSES_POST_INTERVENTION_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const watercoursesPostIntervention = createProjectGetPlugin({
  name: 'watercourses-post-intervention',
  path: WATERCOURSES_POST_INTERVENTION_PATH,
  getController
})
