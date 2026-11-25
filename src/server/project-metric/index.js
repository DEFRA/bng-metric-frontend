import Joi from 'joi'

import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'
import { METRIC_FORMATS, getController } from './controller.js'

export const projectMetric = {
  plugin: {
    name: 'project-metric',
    register(server) {
      server.route({
        method: 'GET',
        path: '/projects/{id}/metric.{format}',
        ...getController,
        options: {
          auth: 'session',
          pre: [requireBngCompleterRole],
          validate: {
            params: Joi.object({
              id: Joi.string().guid({ version: 'uuidv4' }).required(),
              format: Joi.string()
                .valid(...Object.keys(METRIC_FORMATS))
                .required()
            })
          }
        }
      })
    }
  }
}
