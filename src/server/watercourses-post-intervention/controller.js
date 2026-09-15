import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  hasBaselineData,
  hasPostInterventionOnlyHabitat
} from '../common/helpers/project-state.js'
import {
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_HABITAT_KEY,
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
import { visibleInterventionTabs } from '../common/helpers/intervention-tabs.js'
import {
  DEFAULT_PROJECT_NAME,
  WATERCOURSES_TOTAL_KEY
} from '../common/constants.js'

const PAGE_HEADING = 'Post intervention for watercourses'
const RESULTS_HEADING = 'Watercourses results'
const DETAILS_HEADING = 'Watercourses habitat details'
const INTERVENTION_TABS_TITLE = 'Intervention type'

export function buildWatercoursesPostIntervention(project, projectId) {
  const pageHref = projectPageHref(
    projectId,
    WATERCOURSES_POST_INTERVENTION_PATH
  )
  const uploadHref = uploadFileHref(projectId, pageHref)
  const postInterventionOnly = hasPostInterventionOnlyHabitat(
    project,
    WATERCOURSES_HABITAT_KEY
  )
  const intervention = project?.postIntervention
    ? watercoursesInterventionSummary(project.postIntervention.units)
    : null
  const features = project?.postIntervention?.[WATERCOURSES_HABITAT_KEY] ?? []
  const tabs = visibleInterventionTabs(features).map(({ id, label }) => ({
    id,
    label,
    panel: { html: '' }
  }))

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    heading: PAGE_HEADING,
    resultsHeading: RESULTS_HEADING,
    detailsHeading: DETAILS_HEADING,
    interventionTabsTitle: INTERVENTION_TABS_TITLE,
    uploadHref,
    navigationItems: buildUnitTypeNavigation(project, projectId, pageHref),
    tabs,
    unitSummary: buildUnitSummary({
      label: WATERCOURSES_TEXT,
      baselineUnits: project?.baseline?.units?.[WATERCOURSES_TOTAL_KEY],
      uploadHref,
      intervention,
      postInterventionOnly,
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

    if (hasBaselineData(project)) {
      const viewModel = buildWatercoursesPostIntervention(project, id)

      return h.view('watercourses-post-intervention/index', {
        pageTitle: PAGE_HEADING,
        ...viewModel
      })
    }

    return h.redirect(`/add-project-details/${id}`)
  }
}
