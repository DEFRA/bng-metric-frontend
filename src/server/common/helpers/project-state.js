function isBaselineOnlyProject(project) {
  return Boolean(project?.baseline) && !project?.postIntervention
}

export { isBaselineOnlyProject }
