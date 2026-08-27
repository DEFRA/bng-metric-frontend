import Joi from 'joi'

import { requireBngCompleterRole } from './auth/verify-role.js'

function createProjectGetPlugin({ name, path, getController }) {
  return {
    plugin: {
      name,
      register(server) {
        server.route({
          method: 'GET',
          path: `/projects/{id}/${path}`,
          ...getController,
          options: {
            ...getController.options,
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
}

export { createProjectGetPlugin }
