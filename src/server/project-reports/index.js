import Joi from 'joi'

import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'
import { getController } from './controller.js'

export const projectReports = {
  plugin: {
    name: 'project-reports',
    register(server) {
      server.route({
        method: 'GET',
        path: '/projects/{id}/reports',
        ...getController,
        options: {
          auth: 'session',
          pre: [requireBngCompleterRole],
          validate: {
            params: Joi.object({
              id: Joi.string().guid({ version: 'uuidv4' }).required()
            })
          }
        }
      })
    }
  }
}
