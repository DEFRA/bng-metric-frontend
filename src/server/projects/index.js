import { projectsListController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /manage-projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Manage projects
 *     description: Lists all projects for the authenticated user
 *     responses:
 *       200:
 *         description: Renders the manage projects page
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
      server.route({
        method: 'GET',
        path: '/manage-projects',
        ...projectsListController,
        options: {
          ...projectsListController.options,
          ...protectedRouteOptions
        }
      })
    }
  }
}
