import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const uploadPostInterventionFile = {
  plugin: {
    name: 'upload-post-intervention-file',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-post-intervention-file',
          ...getController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
