import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import {
  hasBaselineData,
  hasPostInterventionOnlyHabitat,
  projectHasHabitatData
} from '../common/helpers/project-state.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  AREA_BASELINE_PATH,
  AREA_HABITATS_TEXT,
  AREA_SUMMARY_PATH,
  HEDGEROWS_BASELINE_PATH,
  HEDGEROWS_HABITAT_KEY,
  HEDGEROWS_SUMMARY_PATH,
  HEDGEROWS_TEXT,
  PROJECT_SUMMARY_PATH,
  SUMMARY_TEXT,
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_HABITAT_KEY,
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import {
  areaBaselineAction,
  areaInterventionSummary,
  areaUnits,
  buildUnitSummary,
  hedgerowsBaselineAction,
  hedgerowsInterventionSummary,
  watercoursesBaselineAction,
  watercoursesInterventionSummary
} from '../common/helpers/unit-summary.js'
import {
  DEFAULT_PROJECT_NAME,
  HEDGEROWS_TOTAL_KEY,
  WATERCOURSES_TOTAL_KEY
} from '../common/constants.js'

function buildUnitTypeSummary(
  unitType,
  postInterventionUnits,
  uploadHref,
  hasPostIntervention
) {
  const intervention = hasPostIntervention
    ? unitType.buildIntervention(postInterventionUnits)
    : null

  return buildUnitSummary({
    label: unitType.label,
    baselineUnits: unitType.baselineUnits,
    uploadHref,
    intervention,
    headingHref: unitType.href,
    postInterventionOnly: unitType.postInterventionOnly,
    baselineAction: unitType.baselineAction
  })
}

function buildProjectUnitTypes(project, projectId, baselineUnits) {
  return [
    {
      visible: true,
      label: AREA_HABITATS_TEXT,
      href: projectPageHref(projectId, AREA_SUMMARY_PATH),
      baselineAction: areaBaselineAction(
        projectPageHref(projectId, AREA_BASELINE_PATH)
      ),
      baselineUnits: areaUnits(baselineUnits),
      buildIntervention: areaInterventionSummary
    },
    {
      visible: projectHasHabitatData(project, HEDGEROWS_HABITAT_KEY),
      label: HEDGEROWS_TEXT,
      href: projectPageHref(projectId, HEDGEROWS_SUMMARY_PATH),
      baselineUnits: baselineUnits?.[HEDGEROWS_TOTAL_KEY],
      baselineAction: hedgerowsBaselineAction(
        projectPageHref(projectId, HEDGEROWS_BASELINE_PATH)
      ),
      postInterventionOnly: hasPostInterventionOnlyHabitat(
        project,
        HEDGEROWS_HABITAT_KEY
      ),
      buildIntervention: hedgerowsInterventionSummary
    },
    {
      visible: projectHasHabitatData(project, WATERCOURSES_HABITAT_KEY),
      label: WATERCOURSES_TEXT,
      href: projectPageHref(projectId, WATERCOURSES_SUMMARY_PATH),
      baselineUnits: baselineUnits?.[WATERCOURSES_TOTAL_KEY],
      baselineAction: watercoursesBaselineAction(
        projectPageHref(projectId, WATERCOURSES_BASELINE_PATH)
      ),
      postInterventionOnly: hasPostInterventionOnlyHabitat(
        project,
        WATERCOURSES_HABITAT_KEY
      ),
      buildIntervention: watercoursesInterventionSummary
    }
  ]
}

function buildProjectSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = projectPageHref(projectId, PROJECT_SUMMARY_PATH)
  const uploadHref = uploadFileHref(projectId, returnUrl)
  const visibleUnitTypes = buildProjectUnitTypes(
    project,
    projectId,
    baselineUnits
  ).filter(({ visible }) => visible)

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      projectPageHref(projectId, PROJECT_SUMMARY_PATH)
    ),
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
    const project = await fetchProjectOrThrow(request, id)

    if (hasBaselineData(project)) {
      const summary = buildProjectSummary(project, id)

      return h.view('project-summary/index', {
        pageTitle: SUMMARY_TEXT,
        heading: SUMMARY_TEXT,
        ...summary
      })
    }

    return h.redirect(`/add-project-details/${id}`)
  }
}

export { buildProjectSummary }
