import {
  changeProjectNameController,
  changeProjectNamePostController
} from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /change-project-name/{id}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Change project name form
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the change project name form
 *       302:
 *         description: Redirects to login if not authenticated
 *   post:
 *     tags:
 *       - Projects
 *     summary: Submit updated project name
 *     parameters:
 *       - in: path
 *         name: id
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
 *             required:
 *               - projectName
 *             properties:
 *               projectName:
 *                 type: string
 *     responses:
 *       302:
 *         description: Redirects to the project task list on success
 *       400:
 *         description: Validation error, re-renders the form
 */
const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const changeProjectName = {
  plugin: {
    name: 'changeProjectName',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/change-project-name/{id}',
          ...changeProjectNameController,
          options: {
            ...changeProjectNameController.options,
            ...protectedRouteOptions
          }
        },
        {
          method: 'POST',
          path: '/change-project-name/{id}',
          ...changeProjectNamePostController,
          options: {
            ...changeProjectNamePostController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
