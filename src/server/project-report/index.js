import Joi from 'joi'

import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'
import { getController } from './controller.js'

export const projectReport = {
  plugin: {
    name: 'project-report',
    register(server) {
      server.route({
        method: 'GET',
        path: '/projects/{id}/report.pdf',
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
