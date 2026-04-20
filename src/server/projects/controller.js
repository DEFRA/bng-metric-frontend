import { config } from '../../config/config.js'

const backendUrl = config.get('backend').url

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
    const response = await fetch(`${backendUrl}/projects/${id}`)
    const data = await response.json()

    return h.view('projects/detail', {
      pageTitle: data.project?.name ?? 'Project',
      heading: data.project?.name ?? 'Project',
      project: data
    })
  }
}

export const projectTaskListController = {
  async handler(request, h) {
    const { id } = request.params
    const response = await fetch(`${backendUrl}/projects/${id}`)
    const data = await response.json()

    return h.view('projects/task-list', {
      pageTitle: data.project?.name ?? 'Project',
      heading: data.project?.name ?? 'Project',
      project: data
    })
  }
}
