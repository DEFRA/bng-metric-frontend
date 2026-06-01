import {
  getController,
  postController,
  conditionsProxyController
} from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /baseline-habitat-details:
 *   get:
 *     tags:
 *       - Baseline
 *     summary: Render the habitat details page for an area habitat or hedgerow
 *     description: |
 *       Renders the shared baseline-habitat-details page. The backend resolves
 *       the feature by featureId and reports its type (area habitat or
 *       hedgerow); the page then renders the matching per-type layout. Watercourses
 *       will plug in via the same dispatch when their journey lands.
 *     parameters:
 *       - in: query
 *         name: featureId
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
 *   post:
 *     tags:
 *       - Baseline
 *     summary: Save the area habitat dropdown selections
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - featureId
 *             properties:
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               featureId:
 *                 type: string
 *                 format: uuid
 *               broadHabitat:
 *                 type: string
 *               habitatType:
 *                 type: string
 *               condition:
 *                 type: string
 *     responses:
 *       302:
 *         description: Redirects to the habitat list (Area tab) on success
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
        },
        {
          method: 'POST',
          path: '/baseline-habitat-details',
          ...postController,
          options: {
            ...postController.options,
            ...protectedRouteOptions
          }
        },
        {
          method: 'GET',
          path: '/api/reference/conditions',
          ...conditionsProxyController,
          options: {
            ...conditionsProxyController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
