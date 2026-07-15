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
          ...aboutController,
          options: {
            // 'try' keeps the page public but runs the session scheme, so an
            // expired session is refreshed — or cleared — before the shared
            // header can present stale claims as a signed-in user. (BMD-829)
            auth: { strategy: 'session', mode: 'try' }
          }
        }
      ])
    }
  }
}
