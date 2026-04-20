import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const uploadReceived = {
  plugin: {
    name: 'upload-received',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-received',
          ...getController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
