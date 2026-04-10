import {
  defineProjectNameController,
  defineProjectNamePostController
} from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const defineProjectName = {
  plugin: {
    name: 'defineProjectName',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/define-project-name',
          ...defineProjectNameController,
          options: {
            ...defineProjectNameController.options,
            ...protectedRouteOptions
          }
        },
        {
          method: 'POST',
          path: '/define-project-name',
          ...defineProjectNamePostController,
          options: {
            ...defineProjectNamePostController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
