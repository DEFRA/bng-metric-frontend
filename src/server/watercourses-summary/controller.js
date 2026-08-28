import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import {
  hasBaselineData,
  hasPostInterventionOnlyHabitat
} from '../common/helpers/project-state.js'
import {
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  NET_GAIN_TARGET_PERCENTAGE,
  buildUnitSummary,
  formatOptionalUnits,
  formatUnits,
  isFiniteNumber,
  normaliseUnits
} from '../common/helpers/unit-summary.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

const PERCENTAGE_DIVISOR = 100
const MIN_UNIT_DEFICIT = 0
const NO_POST_INTERVENTION_UNITS = 0

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

function buildWatercoursesSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/watercourses-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)
  const postInterventionOnly = hasPostInterventionOnlyHabitat(
    project,
    'watercourses'
  )

  const interventionSummary = project?.postIntervention
    ? {
        units: isFiniteNumber(postInterventionUnits?.watercoursesTotal)
          ? postInterventionUnits.watercoursesTotal
          : null,
        netUnitChange: postInterventionUnits?.watercoursesNetUnitChange,
        netPercentageChange:
          postInterventionUnits?.watercoursesNetUnitChangePercentage
      }
    : null

  const baselineWatercoursesUnits = normaliseUnits(
    baselineUnits?.watercoursesTotal
  )
  const postInterventionWatercoursesUnits = interventionSummary
    ? interventionSummary.units
    : NO_POST_INTERVENTION_UNITS

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      projectPageHref(projectId, WATERCOURSES_SUMMARY_PATH)
    ),
    unitSummary: buildUnitSummary({
      label: WATERCOURSES_TEXT,
      baselineUnits: baselineWatercoursesUnits,
      uploadHref,
      intervention: interventionSummary,
      postInterventionOnly
    }),
    targetsSummary: buildTargetsSummary(
      baselineWatercoursesUnits,
      postInterventionWatercoursesUnits
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

    const summary = buildWatercoursesSummary(project, id)

    return h.view('watercourses-summary/index', {
      pageTitle: WATERCOURSES_TEXT,
      heading: WATERCOURSES_TEXT,
      ...summary
    })
  }
}

export { buildWatercoursesSummary }
