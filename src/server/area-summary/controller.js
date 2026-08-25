import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import { buildUnitTypeNavigation } from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  NET_GAIN_TARGET_PERCENTAGE,
  areaUnits,
  buildUnitSummary,
  formatOptionalUnits,
  formatUnits,
  isFiniteNumber
} from '../common/helpers/unit-summary.js'

const PERCENTAGE_DIVISOR = 100
const MIN_UNIT_DEFICIT = 0
const NO_POST_INTERVENTION_UNITS = 0
const AREA_HABITATS_LABEL = 'Area habitats'

function buildTargetsSummary(baselineAreaUnits, postInterventionAreaUnits) {
  const unitsRequired =
    baselineAreaUnits * (1 + NET_GAIN_TARGET_PERCENTAGE / PERCENTAGE_DIVISOR)
  const unitDeficit = isFiniteNumber(postInterventionAreaUnits)
    ? Math.max(MIN_UNIT_DEFICIT, unitsRequired - postInterventionAreaUnits)
    : null

  return {
    targetPercentage: { text: `${NET_GAIN_TARGET_PERCENTAGE}%` },
    unitsRequired: `${formatUnits(unitsRequired)} units`,
    unitDeficit: formatOptionalUnits(unitDeficit)
  }
}

function buildAreaSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/area-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)

  const interventionSummary = project?.postIntervention
    ? {
        units: areaUnits(postInterventionUnits, null),
        netUnitChange: postInterventionUnits?.habitatsNetUnitChange,
        netPercentageChange:
          postInterventionUnits?.habitatsNetUnitChangePercentage
      }
    : null

  const baselineAreaUnits = areaUnits(baselineUnits)
  const postInterventionAreaUnits = interventionSummary
    ? interventionSummary.units
    : NO_POST_INTERVENTION_UNITS

  return {
    projectName: project?.name ?? 'Project',
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      AREA_HABITATS_LABEL
    ),
    unitSummary: buildUnitSummary(
      AREA_HABITATS_LABEL,
      baselineAreaUnits,
      uploadHref,
      interventionSummary
    ),
    targetsSummary: buildTargetsSummary(
      baselineAreaUnits,
      postInterventionAreaUnits
    )
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProjectOrThrow(request, id)

    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }

    const summary = buildAreaSummary(project, id)

    return h.view('area-summary/index', {
      pageTitle: AREA_HABITATS_LABEL,
      heading: AREA_HABITATS_LABEL,
      ...summary
    })
  }
}

export { buildAreaSummary }
