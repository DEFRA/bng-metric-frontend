import { config } from '../../config/config.js'
import { wreck } from '../common/helpers/wreck-client.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

async function fetchProjectName(id) {
  try {
    const { payload: data } = await wreck.get(`${backendUrl}/projects/${id}`)
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
