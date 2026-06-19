import Joi from 'joi'
import Boom from '@hapi/boom'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { backendRequest } from '../common/helpers/auth/backend-request.js'
import { projectNameSchema } from '../common/helpers/project-name.js'

const backendUrl = config.get('backend').url

export const changeProjectNameController = {
  options: {
    validate: {
      params: Joi.object({
        id: Joi.string().uuid().required()
      })
    }
  },
  async handler(request, h) {
    const { id } = request.params
    const { res, payload: data } = await backendRequest(
      request,
      'get',
      `${backendUrl}/projects/${id}`
    )

    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to fetch projects')
    }

    if (data?.statusCode === 404) {
      throw Boom.notFound('Project not found')
    }

    return h.view('change-project-name/index', {
      pageTitle: 'Project Name',
      heading: 'Project Name',
      projectId: id,
      projectName: data?.project?.name
    })
  }
}

export const changeProjectNamePostController = {
  options: {
    validate: {
      params: Joi.object({
        id: Joi.string().uuid().required()
      }),
      payload: Joi.object({
        projectName: projectNameSchema
      }),
      failAction: async (request, h, err) => {
        const isPayloadError = err.details.some(
          (d) => d.path[0] === 'projectName'
        )
        if (!isPayloadError) {
          throw err
        }
        const { id } = request.params
        const projectName = request.payload?.projectName
        const errors = err.details.map((d) => ({
          text: d.message,
          href: '#project-name'
        }))
        return h
          .view('change-project-name/index', {
            pageTitle: 'Error: Project Name',
            heading: 'Project Name',
            projectId: id,
            projectName,
            errors,
            errorMessage: { text: errors[0].text }
          })
          .takeover()
      }
    }
  },
  async handler(request, h) {
    const { id } = request.params
    const { projectName } = request.payload

    const { res } = await backendRequest(
      request,
      'patch',
      `${backendUrl}/projects/${id}`,
      {
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({ project: { name: projectName } })
      }
    )

    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to update project name')
    }

    return h.redirect(`/add-project-details/${id}`)
  }
}
