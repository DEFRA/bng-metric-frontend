import { fetchProject } from '../common/services/projects.js'

function listLayersFromBaseline(baseline) {
  if (!baseline) {
    return []
  }
  const layers = []
  if (baseline.redLine) {
    layers.push('Red Line Boundary')
  }
  if (baseline.habitats?.length) {
    layers.push('Habitats')
  }
  if (baseline.hedgerows?.length) {
    layers.push('Hedgerows')
  }
  if (baseline.watercourses?.length) {
    layers.push('Watercourses')
  }
  return layers
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProject(id)
    const projectName = project?.project?.name ?? 'Project'
    const baseline = project?.project?.baseline
    // Temporary entry point for BMD-315: BMD-305 (Habitat List) is the
    // permanent way into the habitat-details page, but it hasn't merged yet.
    // Surfacing the habitats here lets QA reach /baseline-habitat-details
    // without hand-crafting the URL. Remove once BMD-305 is live.
    const habitats = baseline?.habitats ?? []
    const filename = baseline?.filename ?? null
    const layers = listLayersFromBaseline(baseline)

    return h.view('check-baseline-import/check-baseline-import', {
      pageTitle: 'Biodiversity Net Gain - Check Baseline import',
      heading: 'Check your on-site baseline data',
      caption: projectName,
      projectId: id,
      filename,
      habitats,
      layers
    })
  }
}
