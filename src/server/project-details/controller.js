import Joi from 'joi'
import Boom from '@hapi/boom'

import { fetchProject } from '../common/services/projects.js'
import { statusCodes, HTTP_SUCCESS_MAX } from '../common/constants.js'

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
    const result = await fetchProject(request, projectId)
    if (!result) {
      throw Boom.badGateway('Failed to fetch project')
    }
    if (result.statusCode === statusCodes.notFound) {
      throw Boom.notFound('Project not found')
    }
    if (
      result.statusCode < statusCodes.ok ||
      result.statusCode >= HTTP_SUCCESS_MAX
    ) {
      throw Boom.badGateway('Failed to fetch project')
    }
    return h.view('project-details/index', {
      pageTitle: 'Project details',
      projectName: result.payload?.project?.name,
      projectId
    })
  }
}
