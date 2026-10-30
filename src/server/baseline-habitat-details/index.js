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
 *     summary: Render the habitat details page for an area habitat, hedgerow or watercourse
 *     description: |
 *       Renders the shared baseline-habitat-details page. The backend resolves
 *       the feature by featureId and reports its type (area habitat, hedgerow
 *       or watercourse); the page then renders the matching per-type layout,
 *       with the habitat reference as an editable input (BMD-1061).
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
 *     summary: Save the habitat reference and dropdown selections
 *     description: |
 *       Saves an area habitat, hedgerow or watercourse through the backend's
 *       feature PUT. The habitat reference (BMD-1061) is trimmed and sent as
 *       `ref`; a blank, whitespace-only or non-UTF-8 reference re-renders the
 *       page with an error summary and inline error and saves nothing. When the
 *       stored reference is blank and the field is left blank, the reference
 *       is not sent, so the other edits still save. Only a reference the
 *       user changed is checked and sent. Hedgerows and watercourses
 *       send no broad habitat; only watercourses send the encroachment fields.
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
 *               habitatRef:
 *                 type: string
 *                 maxLength: 100
 *                 description: Habitat reference. Longer values are truncated to 100 characters by the backend.
 *               broadHabitat:
 *                 type: string
 *               habitatType:
 *                 type: string
 *               condition:
 *                 type: string
 *               watercourseEncroachment:
 *                 type: string
 *               riparianEncroachment:
 *                 type: string
 *     responses:
 *       302:
 *         description: Redirects to the matching baseline habitat list on success
 *       400:
 *         description: Re-renders the page with an error summary when a changed habitat reference is invalid, or when the backend refuses it. A backend 400 for a save that sent no reference is an error page.
 *       404:
 *         description: The habitat no longer exists
 *       409:
 *         description: Another user is editing this project
 *       502:
 *         description: The backend could not save the habitat
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
