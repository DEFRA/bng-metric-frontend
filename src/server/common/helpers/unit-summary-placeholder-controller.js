import { hasBaselineData } from './project-state.js'
import {
  buildUnitTypeNavigation,
  projectPageHref
} from './unit-type-navigation.js'
import { fetchProjectOrThrow } from './fetch-project.js'

function createUnitSummaryPlaceholderController({
  label,
  current,
  summaryPath
}) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const project = await fetchProjectOrThrow(request, id)

      if (!hasBaselineData(project)) {
        return h.redirect(`/add-project-details/${id}`)
      }

      return h.view('common/templates/unit-summary-placeholder', {
        pageTitle: current,
        heading: current,
        label,
        projectName: project?.name ?? 'Project',
        navigationItems: buildUnitTypeNavigation(
          project,
          id,
          projectPageHref(id, summaryPath)
        )
      })
    }
  }
}

export { createUnitSummaryPlaceholderController }
