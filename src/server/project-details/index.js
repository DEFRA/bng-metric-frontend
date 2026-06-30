import { projectDetailsController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /project-details/{projectId}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Project details
 *     description: Displays the details page for a specific project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the project details page
 *       302:
 *         description: Redirects to login if not authenticated
 *       400:
 *         description: Invalid project ID format
 *       502:
 *         description: Backend unavailable or returned a non-2xx response
 */
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
