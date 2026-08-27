import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { WATERCOURSES_BASELINE_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const watercoursesBaseline = createProjectGetPlugin({
  name: 'watercourses-baseline',
  path: WATERCOURSES_BASELINE_PATH,
  getController
})
