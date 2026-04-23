import { backendClient } from '../common/services/backend-client.js'

export const projectsListController = {
  async handler(_request, h) {
    return h.view('projects/index', {
      pageTitle: 'Projects',
      heading: 'Projects',
      projects: []
    })
  }
}

export const projectDetailController = {
  async handler(request, h) {
    const { id } = request.params
    const { payload } = await backendClient(request).get(`/projects/${id}`, {
      json: true
    })

    return h.view('projects/detail', {
      pageTitle: payload?.project?.name ?? 'Project',
      heading: payload?.project?.name ?? 'Project',
      project: payload
    })
  }
}
