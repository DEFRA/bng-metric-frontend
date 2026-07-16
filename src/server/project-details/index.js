import {
  projectDetailsController,
  projectDetailsPostController
} from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /project-details/{projectId}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Project details form
 *     description: Displays the project details form, pre-filled with any previously saved values
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the project details form
 *       302:
 *         description: Redirects to login if not authenticated
 *       400:
 *         description: Invalid project ID format
 *       502:
 *         description: Backend unavailable or returned a non-2xx response
 *   post:
 *     tags:
 *       - Projects
 *     summary: Save project details
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               localPlanningAuthority:
 *                 type: string
 *               surveyCompleters:
 *                 type: string
 *               surveyCompletionDate:
 *                 type: string
 *               developmentType:
 *                 type: string
 *                 enum: [Small site, Large site]
 *               nsips:
 *                 type: string
 *                 enum: [Yes, No]
 *               applicant:
 *                 type: string
 *     responses:
 *       302:
 *         description: Redirects to the project task list on success
 *       200:
 *         description: Validation failure, re-renders the form with errors
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
        },
        {
          method: 'POST',
          path: '/project-details/{projectId}',
          ...projectDetailsPostController,
          options: {
            ...projectDetailsPostController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
