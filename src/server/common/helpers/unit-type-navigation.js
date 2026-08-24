import { projectHasHabitatData } from './project-state.js'

function buildUnitTypeNavigation(project, projectId, current) {
  const items = [
    { text: 'Summary', href: `/projects/${projectId}/project-summary` },
    { text: 'Area habitats', href: `/projects/${projectId}/area-summary` }
  ]

  if (projectHasHabitatData(project, 'hedgerows')) {
    items.push({
      text: 'Hedgerows',
      href: `/projects/${projectId}/hedgerows-summary`
    })
  }

  if (projectHasHabitatData(project, 'watercourses')) {
    items.push({
      text: 'Watercourses',
      href: `/projects/${projectId}/watercourses-summary`
    })
  }

  const currentItem = items.find((item) => item.text === current)

  if (currentItem) {
    currentItem.current = true
    delete currentItem.href
  }

  return items
}

export { buildUnitTypeNavigation }
