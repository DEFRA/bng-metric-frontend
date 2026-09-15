import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { HEDGEROWS_POST_INTERVENTION_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const hedgerowsPostIntervention = createProjectGetPlugin({
  name: 'hedgerows-post-intervention',
  path: HEDGEROWS_POST_INTERVENTION_PATH,
  getController
})
