import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /projects/{id}/upload-result:
 *   get:
 *     tags:
 *       - Upload
 *     summary: Upload result
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the upload result page
 *       302:
 *         description: Redirects to login if not authenticated
 */
const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const uploadResult = {
  plugin: {
    name: 'upload-result',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-result',
          ...getController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
