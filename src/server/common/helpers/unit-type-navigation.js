import { hasHabitatData, projectHasHabitatData } from './project-state.js'

const SUMMARY_TEXT = 'Summary'
const AREA_HABITATS_TEXT = 'Area habitats'
const BASELINE_TEXT = 'Baseline'
const POST_INTERVENTION_TEXT = 'Post intervention'
const HEDGEROWS_TEXT = 'Hedgerows'
const WATERCOURSES_TEXT = 'Watercourses'
const HEDGEROWS_HABITAT_KEY = 'hedgerows'
const WATERCOURSES_HABITAT_KEY = 'watercourses'

const PROJECT_SUMMARY_PATH = 'project-summary'
const AREA_SUMMARY_PATH = 'area-summary'
const AREA_BASELINE_PATH = 'area-baseline'
const HEDGEROWS_SUMMARY_PATH = 'hedgerows-summary'
const HEDGEROWS_BASELINE_PATH = 'hedgerows-baseline'
const WATERCOURSES_SUMMARY_PATH = 'watercourses-summary'
const WATERCOURSES_BASELINE_PATH = 'watercourses-baseline-summary'
const WATERCOURSES_POST_INTERVENTION_PATH = 'watercourses-post-intervention'

const OPTIONAL_UNIT_TYPES = [
  {
    habitatKey: HEDGEROWS_HABITAT_KEY,
    text: HEDGEROWS_TEXT,
    summaryPath: HEDGEROWS_SUMMARY_PATH,
    baselinePath: HEDGEROWS_BASELINE_PATH
  },
  {
    habitatKey: WATERCOURSES_HABITAT_KEY,
    text: WATERCOURSES_TEXT,
    summaryPath: WATERCOURSES_SUMMARY_PATH,
    baselinePath: WATERCOURSES_BASELINE_PATH,
    postInterventionPath: WATERCOURSES_POST_INTERVENTION_PATH
  }
]

function projectPageHref(projectId, path) {
  return `/projects/${projectId}/${path}`
}

function markCurrent(item, currentHref) {
  if (item.href === currentHref) {
    item.current = true
    delete item.href
    return
  }

  if (item.children) {
    for (const child of item.children) {
      markCurrent(child, currentHref)
    }
  }
}

function withSectionChildren(item, project, projectId, unitType, currentHref) {
  const baselineHref = projectPageHref(projectId, unitType.baselinePath)
  const postInterventionHref = unitType.postInterventionPath
    ? projectPageHref(projectId, unitType.postInterventionPath)
    : null
  const isActiveSection = [
    item.href,
    baselineHref,
    postInterventionHref
  ].includes(currentHref)

  if (isActiveSection) {
    const includeBaseline =
      !unitType.habitatKey ||
      hasHabitatData(project?.baseline, unitType.habitatKey)

    return {
      ...item,
      children: [
        ...(includeBaseline
          ? [{ text: BASELINE_TEXT, href: baselineHref }]
          : []),
        ...(postInterventionHref
          ? [{ text: POST_INTERVENTION_TEXT, href: postInterventionHref }]
          : [])
      ]
    }
  }

  return item
}

function buildUnitTypeNavigation(project, projectId, currentHref) {
  const items = [
    {
      text: SUMMARY_TEXT,
      href: projectPageHref(projectId, PROJECT_SUMMARY_PATH)
    },
    withSectionChildren(
      {
        text: AREA_HABITATS_TEXT,
        href: projectPageHref(projectId, AREA_SUMMARY_PATH)
      },
      project,
      projectId,
      { baselinePath: AREA_BASELINE_PATH },
      currentHref
    )
  ]

  for (const unitType of OPTIONAL_UNIT_TYPES) {
    if (projectHasHabitatData(project, unitType.habitatKey)) {
      items.push(
        withSectionChildren(
          {
            text: unitType.text,
            href: projectPageHref(projectId, unitType.summaryPath)
          },
          project,
          projectId,
          unitType,
          currentHref
        )
      )
    }
  }

  for (const item of items) {
    markCurrent(item, currentHref)
  }

  return items
}

export {
  AREA_BASELINE_PATH,
  AREA_HABITATS_TEXT,
  AREA_SUMMARY_PATH,
  BASELINE_TEXT,
  HEDGEROWS_BASELINE_PATH,
  HEDGEROWS_HABITAT_KEY,
  HEDGEROWS_SUMMARY_PATH,
  HEDGEROWS_TEXT,
  PROJECT_SUMMARY_PATH,
  POST_INTERVENTION_TEXT,
  SUMMARY_TEXT,
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_POST_INTERVENTION_PATH,
  WATERCOURSES_HABITAT_KEY,
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
}
