import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import {
  hasBaselineData,
  hasPostInterventionOnlyHabitat
} from '../common/helpers/project-state.js'
import { buildUnitTypeNavigation } from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  NET_GAIN_TARGET_PERCENTAGE,
  buildUnitSummary,
  formatOptionalUnits,
  formatUnits,
  isFiniteNumber,
  normaliseUnits
} from '../common/helpers/unit-summary.js'

const PERCENTAGE_DIVISOR = 100
const MIN_UNIT_DEFICIT = 0
const NO_POST_INTERVENTION_UNITS = 0
const HEDGEROWS_LABEL = 'Hedgerows'

function buildTargetsSummary(baselineUnits, postInterventionUnits) {
  const unitsRequired =
    baselineUnits * (1 + NET_GAIN_TARGET_PERCENTAGE / PERCENTAGE_DIVISOR)
  const unitDeficit = isFiniteNumber(postInterventionUnits)
    ? Math.max(MIN_UNIT_DEFICIT, unitsRequired - postInterventionUnits)
    : null

  return {
    targetPercentage: { text: `${NET_GAIN_TARGET_PERCENTAGE}%` },
    unitsRequired: `${formatUnits(unitsRequired)} units`,
    unitDeficit: formatOptionalUnits(unitDeficit)
  }
}

function buildHedgerowsSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/hedgerows-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)
  const postInterventionOnly = hasPostInterventionOnlyHabitat(
    project,
    'hedgerows'
  )

  const interventionSummary = project?.postIntervention
    ? {
        units: isFiniteNumber(postInterventionUnits?.hedgerowsTotal)
          ? postInterventionUnits.hedgerowsTotal
          : null,
        netUnitChange: postInterventionUnits?.hedgerowsNetUnitChange,
        netPercentageChange:
          postInterventionUnits?.hedgerowsNetUnitChangePercentage
      }
    : null

  const baselineHedgerowsUnits = normaliseUnits(baselineUnits?.hedgerowsTotal)
  const postInterventionHedgerowsUnits = interventionSummary
    ? interventionSummary.units
    : NO_POST_INTERVENTION_UNITS

  return {
    projectName: project?.name ?? 'Project',
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      HEDGEROWS_LABEL
    ),
    unitSummary: buildUnitSummary({
      label: HEDGEROWS_LABEL,
      baselineUnits: baselineHedgerowsUnits,
      uploadHref,
      intervention: interventionSummary,
      postInterventionOnly
    }),
    targetsSummary: buildTargetsSummary(
      baselineHedgerowsUnits,
      postInterventionHedgerowsUnits
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

    const summary = buildHedgerowsSummary(project, id)

    return h.view('hedgerows-summary/index', {
      pageTitle: HEDGEROWS_LABEL,
      heading: HEDGEROWS_LABEL,
      ...summary
    })
  }
}

export { buildHedgerowsSummary }
