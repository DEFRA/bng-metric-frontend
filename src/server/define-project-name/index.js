import {
  defineProjectNameController,
  defineProjectNamePostController
} from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /define-project-name:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Define project name form
 *     responses:
 *       200:
 *         description: Renders the project name form
 *       302:
 *         description: Redirects to login if not authenticated
 *   post:
 *     tags:
 *       - Projects
 *     summary: Submit project name
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - projectName
 *             properties:
 *               projectName:
 *                 type: string
 *     responses:
 *       302:
 *         description: Redirects to the project dashboard on success
 *       400:
 *         description: Validation error, re-renders the form
 */
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
