import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import routes, { routePath } from './routes.js'

const logger = createLogger()

// Serves Getmapping APGB aerial photography tiles behind a same-origin proxy so
// the licence token never leaves the server, and so WebGL can use the raster
// tiles without cross-origin taint. Mirrors the os-base-map proxy.
export const aerialBaseMap = {
  plugin: {
    name: 'aerial-base-map',
    register(server) {
      const token = config.get('map.aerialToken')
      if (token) {
        logger.info(
          `Aerial map proxy registered at ${routePath} → getmapping.com (token: ${token.slice(0, 4)}...)`
        )
      } else {
        logger.warn(
          'Aerial imagery token (AERIAL_APGB_TOKEN) is not set — aerial layer disabled'
        )
      }

      server.route(routes)
    }
  }
}
