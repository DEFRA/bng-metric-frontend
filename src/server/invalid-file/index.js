import { invalidFileController } from './controller.js'

/**
 * @openapi
 * /invalid-file:
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
    name: 'invalid-file',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/invalid-file',
          ...invalidFileController
        }
      ])
    }
  }
}
