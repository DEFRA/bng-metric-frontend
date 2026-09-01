import { projectHasHabitatData } from './project-state.js'

const SUMMARY_TEXT = 'Summary'
const AREA_HABITATS_TEXT = 'Area habitats'
const BASELINE_TEXT = 'Baseline'
const HEDGEROWS_TEXT = 'Hedgerows'
const WATERCOURSES_TEXT = 'Watercourses'
const REPORTS_TEXT = 'Reports'

const PROJECT_SUMMARY_PATH = 'project-summary'
const AREA_SUMMARY_PATH = 'area-summary'
const AREA_BASELINE_PATH = 'area-baseline'
const HEDGEROWS_SUMMARY_PATH = 'hedgerows-summary'
const WATERCOURSES_SUMMARY_PATH = 'watercourses-summary'
const REPORTS_PATH = 'reports'

function projectPageHref(projectId, path) {
  return `/projects/${projectId}/${path}`
}

function markCurrent(item, currentHref) {
  if (item.href === currentHref) {
    item.current = true
    delete item.href
    return
  }

  if (!item.children) {
    return
  }

  for (const child of item.children) {
    markCurrent(child, currentHref)
  }
}

// Only the unit type being viewed expands, so moving between unit types collapses
// the section you came from and Summary shows every unit type collapsed.
function buildUnitTypeItem({ text, summaryHref, baselineHref, currentHref }) {
  const item = { text, href: summaryHref }

  if (currentHref !== summaryHref && currentHref !== baselineHref) {
    return item
  }

  return {
    ...item,
    children: [{ text: BASELINE_TEXT, href: baselineHref }]
  }
}

function buildUnitTypeNavigation(project, projectId, currentHref) {
  const items = [
    {
      text: SUMMARY_TEXT,
      href: projectPageHref(projectId, PROJECT_SUMMARY_PATH)
    },
    buildUnitTypeItem({
      text: AREA_HABITATS_TEXT,
      summaryHref: projectPageHref(projectId, AREA_SUMMARY_PATH),
      baselineHref: projectPageHref(projectId, AREA_BASELINE_PATH),
      currentHref
    })
  ]

  if (projectHasHabitatData(project, 'hedgerows')) {
    items.push({
      text: HEDGEROWS_TEXT,
      href: projectPageHref(projectId, HEDGEROWS_SUMMARY_PATH)
    })
  }

  if (projectHasHabitatData(project, 'watercourses')) {
    items.push({
      text: WATERCOURSES_TEXT,
      href: projectPageHref(projectId, WATERCOURSES_SUMMARY_PATH)
    })
  }

  // Always last, and not conditional on any habitat type: the site report
  // draws whatever the project holds, so the page it lives on is reachable
  // whenever the project is.
  items.push({
    text: REPORTS_TEXT,
    href: projectPageHref(projectId, REPORTS_PATH)
  })

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
  HEDGEROWS_SUMMARY_PATH,
  HEDGEROWS_TEXT,
  PROJECT_SUMMARY_PATH,
  REPORTS_PATH,
  REPORTS_TEXT,
  SUMMARY_TEXT,
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
}
