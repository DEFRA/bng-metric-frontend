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

function hasPostInterventionOnlyHabitat(project, habitatType) {
  return (
    !hasHabitatData(project?.baseline, habitatType) &&
    hasHabitatData(project?.postIntervention, habitatType)
  )
}

export {
  hasBaselineData,
  hasHabitatData,
  hasPostInterventionOnlyHabitat,
  projectHasHabitatData
}
