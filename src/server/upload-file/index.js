import Joi from 'joi'

import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'
import { getController, postController } from './controller.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

const paramsSchema = Joi.object({
  id: Joi.string().guid({ version: 'uuidv4' }).required()
})

export const uploadFile = {
  plugin: {
    name: 'upload-file',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-file',
          ...getController,
          options: {
            ...getController.options,
            ...protectedRouteOptions,
            validate: {
              ...getController.options?.validate,
              params: paramsSchema
            }
          }
        },
        {
          method: 'POST',
          path: '/projects/{id}/upload-file',
          ...postController,
          options: {
            ...postController.options,
            ...protectedRouteOptions,
            validate: {
              ...postController.options?.validate,
              params: paramsSchema
            }
          }
        }
      ])
    }
  }
}
