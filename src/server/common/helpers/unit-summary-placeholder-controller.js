import { hasBaselineData } from './project-state.js'
import { buildUnitTypeNavigation } from './unit-type-navigation.js'
import { fetchProjectOrThrow } from './fetch-project.js'

function createUnitSummaryPlaceholderController({ label, current }) {
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
        navigationItems: buildUnitTypeNavigation(project, id, current)
      })
    }
  }
}

export { createUnitSummaryPlaceholderController }
