import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import {
  AREA_HABITATS_TEXT,
  AREA_SUMMARY_PATH,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  NET_GAIN_TARGET_PERCENTAGE,
  areaBaselineAction,
  areaInterventionSummary,
  areaUnits,
  buildUnitSummary,
  formatOptionalUnits,
  formatUnits,
  isFiniteNumber
} from '../common/helpers/unit-summary.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

const PERCENTAGE_DIVISOR = 100
const MIN_UNIT_DEFICIT = 0
const NO_POST_INTERVENTION_UNITS = 0

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
    ? areaInterventionSummary(postInterventionUnits)
    : null

  const baselineAreaUnits = areaUnits(baselineUnits)
  const postInterventionAreaUnits = interventionSummary
    ? interventionSummary.units
    : NO_POST_INTERVENTION_UNITS

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      projectPageHref(projectId, AREA_SUMMARY_PATH)
    ),
    unitSummary: buildUnitSummary({
      label: AREA_HABITATS_TEXT,
      baselineUnits: baselineAreaUnits,
      uploadHref,
      intervention: interventionSummary,
      baselineAction: areaBaselineAction(`/projects/${projectId}/area-baseline`)
    }),
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
      pageTitle: AREA_HABITATS_TEXT,
      heading: AREA_HABITATS_TEXT,
      ...summary
    })
  }
}

export { buildAreaSummary }
