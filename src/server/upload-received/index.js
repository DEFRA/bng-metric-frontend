import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /projects/{id}/upload-received:
 *   get:
 *     tags:
 *       - Upload
 *     summary: Upload received confirmation
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the upload received confirmation page
 *       302:
 *         description: Redirects to login if not authenticated
 */
const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const uploadReceived = {
  plugin: {
    name: 'upload-received',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-received',
          ...getController,
          options: protectedRouteOptions
        }
      ])
    }
  }
}
