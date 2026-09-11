import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import {
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_POST_INTERVENTION_PATH,
  WATERCOURSES_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import {
  buildUnitSummary,
  watercoursesBaselineAction,
  watercoursesInterventionSummary
} from '../common/helpers/unit-summary.js'
import { interventionDisplay } from '../post-intervention-habitat-details/retention.js'
import {
  DEFAULT_PROJECT_NAME,
  WATERCOURSES_TOTAL_KEY
} from '../common/constants.js'

const PAGE_HEADING = 'Post intervention for watercourses'
const RESULTS_HEADING = 'Watercourses results'
const DETAILS_HEADING = 'Watercourses habitat details'
const TAB_LABELS = ['Retained', 'Enhanced', 'Created']

export function buildWatercoursesPostIntervention(project, projectId) {
  const pageHref = projectPageHref(
    projectId,
    WATERCOURSES_POST_INTERVENTION_PATH
  )
  const features = project?.postIntervention?.watercourses ?? []
  const visibleTabs = TAB_LABELS.filter((label) =>
    features.some(
      (feature) => interventionDisplay(feature.retentionCategory) === label
    )
  ).map((label) => ({
    id: label.toLowerCase(),
    label,
    panel: { html: '' }
  }))

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    heading: PAGE_HEADING,
    resultsHeading: RESULTS_HEADING,
    detailsHeading: DETAILS_HEADING,
    uploadHref: uploadFileHref(projectId, pageHref),
    navigationItems: buildUnitTypeNavigation(project, projectId, pageHref),
    tabs: visibleTabs,
    unitSummary: buildUnitSummary({
      label: WATERCOURSES_TEXT,
      baselineUnits: project?.baseline?.units?.[WATERCOURSES_TOTAL_KEY],
      uploadHref: uploadFileHref(projectId, pageHref),
      intervention: project?.postIntervention
        ? watercoursesInterventionSummary(project.postIntervention.units)
        : null,
      baselineAction: watercoursesBaselineAction(
        projectPageHref(projectId, WATERCOURSES_BASELINE_PATH)
      ),
      interventionAction: null
    })
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProjectOrThrow(request, id)
    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }
    return h.view('watercourses-post-intervention/index', {
      pageTitle: PAGE_HEADING,
      ...buildWatercoursesPostIntervention(project, id)
    })
  }
}
