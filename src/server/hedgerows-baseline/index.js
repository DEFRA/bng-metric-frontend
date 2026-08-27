import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { HEDGEROWS_BASELINE_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const hedgerowsBaseline = createProjectGetPlugin({
  name: 'hedgerows-baseline',
  path: HEDGEROWS_BASELINE_PATH,
  getController
})
