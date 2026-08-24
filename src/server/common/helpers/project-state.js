function hasBaselineData(project) {
  return Boolean(project?.baseline)
}

function hasHabitatData(habitatData, habitatType) {
  return habitatData?.[habitatType]?.length > 0
}

function projectHasHabitatData(project, habitatType) {
  return [project?.baseline, project?.postIntervention].some((habitatData) =>
    hasHabitatData(habitatData, habitatType)
  )
}

export { hasBaselineData, hasHabitatData, projectHasHabitatData }
