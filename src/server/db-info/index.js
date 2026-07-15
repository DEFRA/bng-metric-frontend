import { dbInfoController } from './controller.js'

/**
 * @openapi
 * /db-info:
 *   get:
 *     tags:
 *       - Health
 *     summary: Database version info
 *     responses:
 *       200:
 *         description: Returns database version information
 */
export const dbInfo = {
  plugin: {
    name: 'db-info',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/db-info',
          ...dbInfoController,
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
