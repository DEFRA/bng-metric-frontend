import Joi from 'joi'
import Boom from '@hapi/boom'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'

const backendUrl = config.get('backend').url

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
    try {
      const { res, payload: data } = await wreck.get(
        `${backendUrl}/projects/${projectId}`
      )
      if (res.statusCode >= statusCodes.badRequest) {
        throw Boom.badGateway('Failed to fetch project')
      }
      return h.view('project-details/index', {
        pageTitle: 'Project details',
        projectName: data?.project?.name,
        projectId
      })
    } catch (err) {
      if (err.isBoom) throw err
      throw Boom.badGateway('Failed to fetch project')
    }
  }
}
