import { projectHasHabitatData } from './project-state.js'

const SUMMARY_TEXT = 'Summary'
const AREA_HABITATS_TEXT = 'Area habitats'
const BASELINE_TEXT = 'Baseline'
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
const WATERCOURSES_BASELINE_PATH = 'watercourses-baseline'

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

function withBaselineChild(item, projectId, baselinePath, currentHref) {
  const baselineHref = projectPageHref(projectId, baselinePath)
  const isActiveSection =
    currentHref === item.href || currentHref === baselineHref

  if (isActiveSection) {
    return {
      ...item,
      children: [
        {
          text: BASELINE_TEXT,
          href: baselineHref
        }
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
    withBaselineChild(
      {
        text: AREA_HABITATS_TEXT,
        href: projectPageHref(projectId, AREA_SUMMARY_PATH)
      },
      projectId,
      AREA_BASELINE_PATH,
      currentHref
    )
  ]

  for (const unitType of OPTIONAL_UNIT_TYPES) {
    if (projectHasHabitatData(project, unitType.habitatKey)) {
      items.push(
        withBaselineChild(
          {
            text: unitType.text,
            href: projectPageHref(projectId, unitType.summaryPath)
          },
          projectId,
          unitType.baselinePath,
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
  SUMMARY_TEXT,
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_HABITAT_KEY,
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
}
