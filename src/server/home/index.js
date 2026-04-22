import { homeController } from './controller.js'

/**
 * @openapi
 * /:
 *   get:
 *     tags:
 *       - Pages
 *     summary: Home page
 *     responses:
 *       200:
 *         description: Renders the home page
 */
export const home = {
  plugin: {
    name: 'home',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/',
          ...homeController
        }
      ])
    }
  }
}
