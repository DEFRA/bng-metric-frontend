import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const postInterventionUploadReceived = {
  plugin: {
    name: 'post-intervention-upload-received',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/post-intervention-upload-received',
          ...getController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
