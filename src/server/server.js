import path from 'path'
import hapi from '@hapi/hapi'
import Scooter from '@hapi/scooter'

import { router } from './router.js'
import { config } from '../config/config.js'
import { pulse } from './common/helpers/pulse.js'
import { catchAll } from './common/helpers/errors.js'
import { nunjucksConfig } from '../config/nunjucks/nunjucks.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { sessionCorrelation } from './common/helpers/logging/session-correlation.js'
import { sessionCache } from './common/helpers/session-cache/session-cache.js'
import { getCacheEngine } from './common/helpers/session-cache/cache-engine.js'
import { authScheme } from './common/helpers/auth/auth-scheme.js'
import { csrf } from './common/helpers/csrf.js'
import { secureContext } from '@defra/hapi-secure-context'
import { contentSecurityPolicy } from './common/helpers/content-security-policy.js'
import { metrics } from '@defra/cdp-metrics'

export async function createServer() {
  setupProxy()
  const server = hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      // Cap incoming request bodies explicitly instead of relying on Hapi's
      // ~1 MB default. File uploads bypass this app (browser → CDP Uploader →
      // S3), so routes here only ever receive small JSON/form bodies; 2 MB is
      // ample headroom. This is separate from the upload file-size limit.
      payload: {
        maxBytes: config.get('requestPayloadMaxBytes')
      },
      validate: {
        options: {
          abortEarly: false
        }
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    },
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine(config.get('session.cache.engine'))
      }
    ],
    state: {
      strictHeader: false
    }
  })
  await server.register([
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse,
    sessionCache,
    sessionCorrelation,
    authScheme,
    csrf,
    nunjucksConfig,
    Scooter,
    contentSecurityPolicy,
    router // Register all the controllers/routes defined in src/server/router.js
  ])

  server.ext('onPreResponse', catchAll)

  return server
}
