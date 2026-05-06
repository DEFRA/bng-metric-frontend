import Joi from 'joi'
import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'

const backendUrl = config.get('backend').url

export const projectsListController = {
  async handler(request, h) {
    const userId = request.auth.credentials.sub
    const { res, payload: projects } = await wreck.get(
      `${backendUrl}/users/${userId}/projects`
    )

    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to fetch projects')
    }

    return h.view('projects/index', {
      pageTitle: 'Projects',
      heading: 'Manage your Biodiversity Net Gain projects',
      projects
    })
  }
}

export const projectTaskListController = {
  options: {
    validate: {
      params: Joi.object({
        id: Joi.string().uuid().required()
      })
    }
  },
  async handler(request, h) {
    const { id } = request.params
    const { payload: data } = await wreck.get(`${backendUrl}/projects/${id}`)

    return h.view('projects/task-list', {
      pageTitle: 'Project Task List',
      heading: 'Add your Biodiversity Net Gain project details',
      caption: data?.project?.name ?? 'Project not found',
      data,
      id,
      error: data?.statusCode === 404
    })
  }
}
