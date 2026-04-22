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
          ...dbInfoController
        }
      ])
    }
  }
}
