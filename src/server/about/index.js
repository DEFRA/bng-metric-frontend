import { aboutController } from './controller.js'

/**
 * @openapi
 * /about:
 *   get:
 *     tags:
 *       - Pages
 *     summary: About page
 *     responses:
 *       200:
 *         description: Renders the about page
 */
export const about = {
  plugin: {
    name: 'about',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/about',
          ...aboutController
        }
      ])
    }
  }
}
