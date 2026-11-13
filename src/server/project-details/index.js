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
 *       - in: query
 *         name: returnUrl
 *         required: false
 *         schema:
 *           type: string
 *         description: The page Save and Cancel return to. Defaults to the project summary.
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
 *               projectName:
 *                 type: string
 *               surveyCompleters:
 *                 type: string
 *               surveyCompletionDate-day:
 *                 type: string
 *               surveyCompletionDate-month:
 *                 type: string
 *               surveyCompletionDate-year:
 *                 type: string
 *               applicant:
 *                 type: string
 *               localPlanningAuthorityReference:
 *                 type: string
 *               planningApplicationReference:
 *                 type: string
 *               planningApplicationType:
 *                 type: string
 *               returnUrl:
 *                 type: string
 *     responses:
 *       302:
 *         description: Redirects to returnUrl (or the project summary) on success
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
