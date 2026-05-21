import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /baseline-habitat-details:
 *   get:
 *     tags:
 *       - Baseline
 *     summary: Render the read-only habitat details page for one area habitat
 *     parameters:
 *       - in: query
 *         name: habitatId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the habitat details page
 *       302:
 *         description: Redirects to login if not authenticated
 *       404:
 *         description: Habitat not found
 */
const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const baselineHabitatDetails = {
  plugin: {
    name: 'baseline-habitat-details',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/baseline-habitat-details',
          ...getController,
          options: {
            ...getController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
