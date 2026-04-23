import { backendClient } from '../common/services/backend-client.js'

async function fetchProjectName(request, id) {
  try {
    const { payload } = await backendClient(request).get(`/projects/${id}`, {
      json: true
    })
    return payload?.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const projectName = await fetchProjectName(request, id)
    const baseline = request.yar.get('baseline')
    const filename = baseline?.filename ?? null

    return h.view('check-baseline-import/check-baseline-import', {
      pageTitle: 'Biodiversity Net Gain - Check Baseline import',
      heading: 'Check your on-site baseline data',
      caption: projectName,
      projectId: id,
      filename
    })
  }
}
