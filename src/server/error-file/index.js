import { invalidFileController } from './controller.js'

/**
 * @openapi
 * /error-file:
 *   get:
 *     tags:
 *       - Pages
 *     summary: Validation dropout page
 *     responses:
 *       200:
 *         description: Renders the dropout page
 */
export const invalidFile = {
  plugin: {
    name: 'error-file',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/error-file',
          ...invalidFileController,
          options: { auth: 'session' }
        }
      ])
    }
  }
}
