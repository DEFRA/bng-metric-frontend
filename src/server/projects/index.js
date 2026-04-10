import {
  projectsListController,
  projectDetailController
} from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const projects = {
  plugin: {
    name: 'projects',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects',
          ...projectsListController,
          options: {
            ...projectsListController.options,
            ...protectedRouteOptions
          }
        },
        {
          method: 'GET',
          path: '/projects/{id}',
          ...projectDetailController,
          options: {
            ...projectDetailController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
