import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import {
  hasBaselineData,
  hasPostInterventionOnlyHabitat,
  projectHasHabitatData
} from '../common/helpers/project-state.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  AREA_HABITATS_TEXT,
  HEDGEROWS_TEXT,
  PROJECT_SUMMARY_PATH,
  SUMMARY_TEXT,
  WATERCOURSES_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import {
  areaBaselineAction,
  areaInterventionSummary,
  areaUnits,
  buildUnitSummary
} from '../common/helpers/unit-summary.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

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

function buildProjectSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/project-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)

  const unitTypes = [
    {
      visible: true,
      label: AREA_HABITATS_TEXT,
      href: `/projects/${projectId}/area-summary`,
      baselineAction: areaBaselineAction(
        `/projects/${projectId}/area-baseline`
      ),
      baselineUnits: areaUnits(baselineUnits),
      buildIntervention: areaInterventionSummary
    },
    {
      visible: projectHasHabitatData(project, 'hedgerows'),
      label: HEDGEROWS_TEXT,
      href: `/projects/${projectId}/hedgerows-summary`,
      baselineUnits: baselineUnits?.hedgerowsTotal,
      postInterventionOnly: hasPostInterventionOnlyHabitat(
        project,
        'hedgerows'
      ),
      buildIntervention: (units) => ({
        units: units?.hedgerowsTotal,
        netUnitChange: units?.hedgerowsNetUnitChange,
        netPercentageChange: units?.hedgerowsNetUnitChangePercentage
      })
    },
    {
      visible: projectHasHabitatData(project, 'watercourses'),
      label: WATERCOURSES_TEXT,
      href: `/projects/${projectId}/watercourses-summary`,
      baselineUnits: baselineUnits?.watercoursesTotal,
      postInterventionOnly: hasPostInterventionOnlyHabitat(
        project,
        'watercourses'
      ),
      buildIntervention: (units) => ({
        units: units?.watercoursesTotal,
        netUnitChange: units?.watercoursesNetUnitChange,
        netPercentageChange: units?.watercoursesNetUnitChangePercentage
      })
    }
  ]
  const visibleUnitTypes = unitTypes.filter(({ visible }) => visible)

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

    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }

    const summary = buildProjectSummary(project, id)

    return h.view('project-summary/index', {
      pageTitle: SUMMARY_TEXT,
      heading: SUMMARY_TEXT,
      ...summary
    })
  }
}

export { buildProjectSummary }
