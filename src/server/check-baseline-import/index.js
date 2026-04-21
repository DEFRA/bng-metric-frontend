import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const checkBaselineImport = {
  plugin: {
    name: 'check-baseline-import',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/check-baseline-import',
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
