function hasBaselineData(project) {
  return Boolean(project?.baseline)
}

function hasHedgerows(project) {
  return (
    (project?.baseline?.hedgerows?.length ?? 0) > 0 ||
    (project?.postIntervention?.hedgerows?.length ?? 0) > 0
  )
}

function hasWatercourses(project) {
  return (
    (project?.baseline?.watercourses?.length ?? 0) > 0 ||
    (project?.postIntervention?.watercourses?.length ?? 0) > 0
  )
}

export { hasBaselineData, hasHedgerows, hasWatercourses }
