import { config } from '../../config/config.js'
import { wreck } from '../common/helpers/wreck-client.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

async function fetchProject(id) {
  try {
    const { payload: data } = await wreck.get(`${backendUrl}/projects/${id}`)
    return data ?? null
  } catch {
    return null
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProject(id)
    const projectName = project?.project?.name ?? 'Project'
    // Temporary entry point for BMD-315: BMD-305 (Habitat List) is the
    // permanent way into the habitat-details page, but it hasn't merged yet.
    // Surfacing the habitats here lets QA reach /baseline-habitat-details
    // without hand-crafting the URL. Remove once BMD-305 is live.
    const habitats = project?.project?.baseline?.habitats ?? []
    const baseline = request.yar.get('baseline')
    const filename = baseline?.filename ?? null

    return h.view('check-baseline-import/check-baseline-import', {
      pageTitle: 'Biodiversity Net Gain - Check Baseline import',
      heading: 'Check your on-site baseline data',
      caption: projectName,
      projectId: id,
      filename,
      habitats
    })
  }
}
