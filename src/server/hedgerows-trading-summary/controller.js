import { hasBaselineData } from '../common/helpers/project-state.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  HEDGEROWS_TRADING_SUMMARY_PATH,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProjectOrThrow(request, id)

    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }

    return h.view('hedgerows-trading-summary/index', {
      pageTitle: 'Hedgerows trading rules',
      heading: 'Hedgerows trading rules',
      projectName: project?.name ?? DEFAULT_PROJECT_NAME,
      navigationItems: buildUnitTypeNavigation(
        project,
        id,
        projectPageHref(id, HEDGEROWS_TRADING_SUMMARY_PATH)
      )
    })
  }
}
