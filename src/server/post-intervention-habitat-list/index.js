import Joi from 'joi'
import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const postInterventionHabitatList = {
  plugin: {
    name: 'post-intervention-habitat-list',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/post-intervention-habitat-list',
          options: {
            ...protectedRouteOptions,
            validate: {
              params: Joi.object({
                id: Joi.string().guid({ version: 'uuidv4' }).required()
              })
            },
            handler: getController.handler
          }
        }
      ])
    }
  }
}
