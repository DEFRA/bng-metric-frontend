import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../common/constants.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import {
  hasBaselineData,
  projectHasHabitatData
} from '../common/helpers/project-state.js'
import { fetchProject } from '../common/services/projects.js'
import {
  areaUnits,
  buildUnitSummary,
  formatUnits,
  percentageSummary
} from '../common/helpers/unit-summary.js'

const FETCH_PROJECT_ERROR = 'Failed to fetch project'

function buildUnitTypeSummary(
  unitType,
  postInterventionUnits,
  uploadHref,
  hasPostIntervention
) {
  const intervention = hasPostIntervention
    ? unitType.buildIntervention(postInterventionUnits)
    : null

  return buildUnitSummary(
    unitType.label,
    unitType.baselineUnits,
    uploadHref,
    intervention,
    unitType.headingHref
  )
}

function buildProjectSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/project-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)

  const unitTypes = [
    {
      visible: true,
      label: 'Area habitats',
      href: `/projects/${projectId}/area-summary`,
      headingHref: `/projects/${projectId}/area-summary`,
      baselineUnits: areaUnits(baselineUnits),
      buildIntervention: (units) => ({
        units: areaUnits(units, null),
        netUnitChange: units?.habitatsNetUnitChange,
        netPercentageChange: units?.habitatsNetUnitChangePercentage
      })
    },
    {
      visible: projectHasHabitatData(project, 'hedgerows'),
      label: 'Hedgerows',
      baselineUnits: baselineUnits?.hedgerowsTotal,
      buildIntervention: (units) => ({
        units: units?.hedgerowsTotal,
        netUnitChange: units?.hedgerowsNetUnitChange,
        netPercentageChange: units?.hedgerowsNetUnitChangePercentage
      })
    },
    {
      visible: projectHasHabitatData(project, 'watercourses'),
      label: 'Watercourses',
      baselineUnits: baselineUnits?.watercoursesTotal,
      buildIntervention: (units) => ({
        units: units?.watercoursesTotal,
        netUnitChange: units?.watercoursesNetUnitChange,
        netPercentageChange: units?.watercoursesNetUnitChangePercentage
      })
    }
  ]
  const visibleUnitTypes = unitTypes.filter(({ visible }) => visible)

  return {
    projectName: project?.name ?? 'Project',
    uploadHref,
    navigationItems: [
      { text: 'Summary', current: true },
      ...visibleUnitTypes.map(({ label, href }) => ({
        text: label,
        ...(href && { href })
      }))
    ],
    unitSummaries: visibleUnitTypes.map((unitType) =>
      buildUnitTypeSummary(
        unitType,
        postInterventionUnits,
        uploadHref,
        Boolean(project?.postIntervention)
      )
    )
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
