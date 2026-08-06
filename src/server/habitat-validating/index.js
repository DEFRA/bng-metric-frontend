import {
  baselineValidatingController,
  postInterventionValidatingController
} from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

/**
 * @openapi
 * /projects/{id}/validating-baseline:
 *   get:
 *     tags:
 *       - Upload
 *     summary: Poll asynchronous baseline validation progress
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the "Checking your file" screen while validation runs
 *       302:
 *         description: Redirects to the habitat list or dropout page once validation completes
 */
export const habitatValidating = {
  plugin: {
    name: 'habitat-validating',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/validating-baseline',
          ...baselineValidatingController,
          options: protectedRouteOptions
        },
        {
          method: 'GET',
          path: '/projects/{id}/validating-post-intervention',
          ...postInterventionValidatingController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
