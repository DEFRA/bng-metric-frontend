import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../common/constants.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import { fetchProject } from '../common/services/projects.js'
import {
  areaUnits,
  buildUnitSummary,
  formatUnits,
  percentageSummary
} from '../common/helpers/unit-summary.js'

const FETCH_PROJECT_ERROR = 'Failed to fetch project'

function buildProjectSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/project-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)

  const interventionSummary = project?.postIntervention
    ? {
        areaHabitats: {
          units: areaUnits(postInterventionUnits, null),
          netUnitChange: postInterventionUnits?.habitatsNetUnitChange,
          netPercentageChange:
            postInterventionUnits?.habitatsNetUnitChangePercentage
        },
        hedgerows: {
          units: postInterventionUnits?.hedgerowsTotal,
          netUnitChange: postInterventionUnits?.hedgerowsNetUnitChange,
          netPercentageChange:
            postInterventionUnits?.hedgerowsNetUnitChangePercentage
        },
        watercourses: {
          units: postInterventionUnits?.watercoursesTotal,
          netUnitChange: postInterventionUnits?.watercoursesNetUnitChange,
          netPercentageChange:
            postInterventionUnits?.watercoursesNetUnitChangePercentage
        }
      }
    : null

  return {
    projectName: project?.name ?? 'Project',
    uploadHref,
    navigationItems: [
      { text: 'Summary', current: true },
      { text: 'Area Habitats', href: `/projects/${projectId}/area-summary` },
      { text: 'Hedgerows' },
      { text: 'Watercourses' }
    ],
    unitSummaries: [
      buildUnitSummary(
        'Area habitats',
        areaUnits(baselineUnits),
        uploadHref,
        interventionSummary?.areaHabitats,
        `/projects/${projectId}/area-summary`
      ),
      buildUnitSummary(
        'Hedgerows',
        baselineUnits?.hedgerowsTotal,
        uploadHref,
        interventionSummary?.hedgerows
      ),
      buildUnitSummary(
        'Watercourses',
        baselineUnits?.watercoursesTotal,
        uploadHref,
        interventionSummary?.watercourses
      )
    ]
  }
}

export const getController = {
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

    const summary = buildProjectSummary(project, id)

    return h.view('project-summary/index', {
      pageTitle: 'Summary',
      heading: 'Summary',
      ...summary
    })
  }
}

export { buildProjectSummary, formatUnits, percentageSummary }
