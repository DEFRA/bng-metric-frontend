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
          ...homeController,
          options: {
            // 'try' keeps the page public but runs the session scheme, so an
            // expired session is refreshed — or cleared — before the page can
            // present stale claims as a signed-in user. (BMD-829)
            auth: { strategy: 'session', mode: 'try' }
          }
        }
      ])
    }
  }
}
