import {
  projectsListController,
  projectDetailController
} from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /project-dashboard:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Project dashboard
 *     description: Lists all projects for the authenticated user
 *     responses:
 *       200:
 *         description: Renders the project dashboard
 *       302:
 *         description: Redirects to login if not authenticated
 * /project-dashboard/{id}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Project detail
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the project detail page
 *       302:
 *         description: Redirects to login if not authenticated
 */
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
          path: '/project-dashboard',
          ...projectsListController,
          options: {
            ...projectsListController.options,
            ...protectedRouteOptions
          }
        },
        {
          method: 'GET',
          path: '/project-dashboard/{id}',
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
