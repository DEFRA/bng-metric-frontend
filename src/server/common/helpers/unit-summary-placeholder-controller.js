import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../constants.js'
import { hasBaselineData } from './project-state.js'
import { buildUnitTypeNavigation } from './unit-type-navigation.js'
import { fetchProject } from '../services/projects.js'

const FETCH_PROJECT_ERROR = 'Failed to fetch project'

function createUnitSummaryPlaceholderController({ label, current }) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const result = await fetchProject(request, id)

      if (!result) {
        throw Boom.badGateway(FETCH_PROJECT_ERROR)
      }
      if (result.statusCode === statusCodes.notFound) {
        throw Boom.notFound('Project not found')
      }
      if (
        result.statusCode < statusCodes.ok ||
        result.statusCode >= HTTP_SUCCESS_MAX
      ) {
        throw Boom.badGateway(FETCH_PROJECT_ERROR)
      }

      const project = result.payload?.project

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
