function hasBaselineData(project) {
  return Boolean(project?.baseline)
}

function hasHabitatData(project, habitatType) {
  return [project?.baseline, project?.postIntervention].some(
    (upload) =>
      Array.isArray(upload?.[habitatType]) && upload[habitatType].length > 0
  )
}

export { hasBaselineData, hasHabitatData }
