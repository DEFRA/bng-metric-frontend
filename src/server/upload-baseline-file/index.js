import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const uploadBaselineFile = {
  plugin: {
    name: 'upload-baseline-file',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-baseline-file',
          ...getController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
