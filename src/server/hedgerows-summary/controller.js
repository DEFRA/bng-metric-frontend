import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import {
  hasBaselineData,
  hasPostInterventionOnlyHabitat
} from '../common/helpers/project-state.js'
import {
  HEDGEROWS_BASELINE_PATH,
  HEDGEROWS_SUMMARY_PATH,
  HEDGEROWS_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  buildTargetsSummary,
  buildUnitSummary,
  hedgerowsBaselineAction,
  isFiniteNumber,
  normaliseUnits
} from '../common/helpers/unit-summary.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

const NO_POST_INTERVENTION_UNITS = 0

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
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      projectPageHref(projectId, HEDGEROWS_SUMMARY_PATH)
    ),
    unitSummary: buildUnitSummary({
      label: HEDGEROWS_TEXT,
      baselineUnits: baselineHedgerowsUnits,
      uploadHref,
      intervention: interventionSummary,
      postInterventionOnly,
      baselineAction: hedgerowsBaselineAction(
        projectPageHref(projectId, HEDGEROWS_BASELINE_PATH)
      )
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
      pageTitle: HEDGEROWS_TEXT,
      heading: HEDGEROWS_TEXT,
      ...summary
    })
  }
}

export { buildHedgerowsSummary }
