import { projectDetailsController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const projectDetails = {
  plugin: {
    name: 'project-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/project-details/{projectId}',
          ...projectDetailsController,
          options: {
            ...projectDetailsController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
