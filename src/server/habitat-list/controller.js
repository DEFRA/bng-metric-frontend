import { fetchProject } from '../common/services/projects.js'

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProject(id)
    const projectName = project?.project?.name ?? 'Project'

    return h.view('habitat-list/habitat-list', {
      pageTitle: 'On-site baseline habitats',
      heading: 'On-site baseline habitats',
      caption: projectName,
      projectId: id
    })
  }
}
