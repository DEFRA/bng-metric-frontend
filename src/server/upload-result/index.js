import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const uploadResult = {
  plugin: {
    name: 'upload-result',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-result',
          ...getController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
