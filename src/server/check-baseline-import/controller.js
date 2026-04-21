import { config } from '../../config/config.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

async function fetchProjectName(id) {
  try {
    const response = await fetch(`${backendUrl}/projects/${id}`)
    const data = await response.json()
    return data.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const projectName = await fetchProjectName(id)
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
