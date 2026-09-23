import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { WATERCOURSES_BASELINE_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const watercoursesBaseline = createProjectGetPlugin({
  name: 'watercourses-baseline',
  path: WATERCOURSES_BASELINE_PATH,
  getController
})

export const watercoursesBaselineLegacy = createProjectGetPlugin({
  name: 'watercourses-baseline-legacy',
  path: 'watercourses-baseline',
  // Compatibility for pre-BMD-862 links. Remove after the agreed migration window.
  getController: {
    handler(request, h) {
      return h
        .redirect(
          `/projects/${request.params.id}/${WATERCOURSES_BASELINE_PATH}`
        )
        .permanent()
    }
  }
})
