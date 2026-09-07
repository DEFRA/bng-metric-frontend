import { hasHabitatData, projectHasHabitatData } from './project-state.js'

const SUMMARY_TEXT = 'Summary'
const AREA_HABITATS_TEXT = 'Area habitats'
const BASELINE_TEXT = 'Baseline'
const POST_INTERVENTION_TEXT = 'Post-intervention'
const HEDGEROWS_TEXT = 'Hedgerows'
const WATERCOURSES_TEXT = 'Watercourses'
const HEDGEROWS_HABITAT_KEY = 'hedgerows'
const WATERCOURSES_HABITAT_KEY = 'watercourses'

const PROJECT_SUMMARY_PATH = 'project-summary'
const AREA_SUMMARY_PATH = 'area-summary'
const AREA_BASELINE_PATH = 'area-baseline'
const HEDGEROWS_SUMMARY_PATH = 'hedgerows-summary'
const HEDGEROWS_BASELINE_PATH = 'hedgerows-baseline'
const HEDGEROWS_POST_INTERVENTION_PATH = 'hedgerows-post-intervention'
const WATERCOURSES_SUMMARY_PATH = 'watercourses-summary'
const WATERCOURSES_BASELINE_PATH = 'watercourses-baseline'

const OPTIONAL_UNIT_TYPES = [
  {
    habitatKey: HEDGEROWS_HABITAT_KEY,
    text: HEDGEROWS_TEXT,
    summaryPath: HEDGEROWS_SUMMARY_PATH,
    baselinePath: HEDGEROWS_BASELINE_PATH,
    postInterventionPath: HEDGEROWS_POST_INTERVENTION_PATH
  },
  {
    habitatKey: WATERCOURSES_HABITAT_KEY,
    text: WATERCOURSES_TEXT,
    summaryPath: WATERCOURSES_SUMMARY_PATH,
    baselinePath: WATERCOURSES_BASELINE_PATH
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

function sectionHrefs(projectId, itemHref, unitType) {
  const hrefs = [itemHref, projectPageHref(projectId, unitType.baselinePath)]

  if (unitType.postInterventionPath) {
    hrefs.push(projectPageHref(projectId, unitType.postInterventionPath))
  }

  return hrefs
}

function buildSectionChildren(project, projectId, unitType) {
  const children = []
  const includeBaseline =
    !unitType.habitatKey ||
    hasHabitatData(project?.baseline, unitType.habitatKey)

  if (includeBaseline) {
    children.push({
      text: BASELINE_TEXT,
      href: projectPageHref(projectId, unitType.baselinePath)
    })
  }

  if (unitType.postInterventionPath) {
    children.push({
      text: POST_INTERVENTION_TEXT,
      href: projectPageHref(projectId, unitType.postInterventionPath)
    })
  }

  return children
}

function withSectionChildren(item, project, projectId, unitType, currentHref) {
  if (sectionHrefs(projectId, item.href, unitType).includes(currentHref)) {
    return {
      ...item,
      children: buildSectionChildren(project, projectId, unitType)
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
  HEDGEROWS_POST_INTERVENTION_PATH,
  HEDGEROWS_SUMMARY_PATH,
  HEDGEROWS_TEXT,
  POST_INTERVENTION_TEXT,
  PROJECT_SUMMARY_PATH,
  SUMMARY_TEXT,
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_HABITAT_KEY,
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
}
