import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /projects/{id}/check-baseline-import:
 *   get:
 *     tags:
 *       - Upload
 *     summary: Check baseline import status
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the baseline import check page
 *       302:
 *         description: Redirects to login if not authenticated
 */
const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const checkBaselineImport = {
  plugin: {
    name: 'check-baseline-import',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/check-baseline-import',
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
