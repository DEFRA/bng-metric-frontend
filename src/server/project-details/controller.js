import Joi from 'joi'
import Boom from '@hapi/boom'

import { fetchProject } from '../common/services/projects.js'

export const projectDetailsController = {
  options: {
    validate: {
      params: Joi.object({
        projectId: Joi.string().guid({ version: 'uuidv4' }).required()
      })
    }
  },
  async handler(request, h) {
    const { projectId } = request.params
    const data = await fetchProject(request, projectId)
    if (!data) {
      throw Boom.badGateway('Failed to fetch project')
    }
    return h.view('project-details/index', {
      pageTitle: 'Project details',
      projectName: data.project?.name,
      projectId
    })
  }
}
