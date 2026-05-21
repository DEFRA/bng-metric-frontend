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

    return h.view('habitat-list/habitat-list', {
      pageTitle: 'On-site baseline habitats',
      heading: 'On-site baseline habitats',
      caption: projectName,
      projectId: id
    })
  }
}
