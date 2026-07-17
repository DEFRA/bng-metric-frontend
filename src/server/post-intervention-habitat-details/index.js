import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const postInterventionHabitatDetails = {
  plugin: {
    name: 'post-intervention-habitat-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/post-intervention-habitat-details',
          ...getController,
          options: {
            ...getController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
