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

/**
 * Whether a post-intervention file has been uploaded to the project. Once it
 * has, the baseline is locked (BMD-1194).
 *
 * @param {object | null | undefined} project
 * @returns {boolean}
 */
function hasPostInterventionData(project) {
  return Boolean(project?.postIntervention)
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
  hasPostInterventionData,
  hasPostInterventionOnlyHabitat,
  projectHasHabitatData
}
