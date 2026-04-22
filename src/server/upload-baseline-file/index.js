import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /projects/{id}/upload-baseline-file:
 *   get:
 *     tags:
 *       - Upload
 *     summary: Upload baseline file page
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the file upload page
 *       302:
 *         description: Redirects to login if not authenticated
 */
const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const uploadBaselineFile = {
  plugin: {
    name: 'upload-baseline-file',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-baseline-file',
          ...getController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
