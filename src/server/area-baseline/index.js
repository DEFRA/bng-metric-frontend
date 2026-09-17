import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { AREA_BASELINE_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const areaBaseline = createProjectGetPlugin({
  name: 'area-baseline',
  path: AREA_BASELINE_PATH,
  getController
})
