import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fourHoursSeconds = 4 * 60 * 60
const oneWeekMs = 604800000
const twoMbInBytes = 2 * 1024 * 1024

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'
const backendUrl = (process.env.BACKEND_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  ''
)

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  requestPayloadMaxBytes: {
    doc: 'Maximum size in bytes for incoming request payloads. Separate from the upload file-size limit: file uploads bypass this app and go to the CDP Uploader, so this only caps the small JSON/form bodies the app actually receives.',
    format: Number,
    default: twoMbInBytes,
    env: 'REQUEST_PAYLOAD_MAX_BYTES'
  },
  backend: {
    url: {
      doc: 'The backend service base URL',
      format: String,
      default: backendUrl,
      env: 'BACKEND_URL'
    },
    timeoutMs: {
      doc: 'Timeout in milliseconds for HTTP requests to backend services. This is the DEFAULT for every backend call, so it stays short: a hung project list or login should fail fast rather than hold a page for a minute.',
      format: Number,
      default: 10000,
      env: 'BACKEND_TIMEOUT_MS'
    },
    validateTimeoutMs: {
      doc: 'Timeout for the GeoPackage validate call specifically, which legitimately takes seconds — download, parse, geometry checks and persist all happen inside it. Separate from the default above so validation can be given room without making every other call hang. Must stay inside the CDP ingress idle timeout, or the user gets a dropped connection instead of a handled error; 25s is chosen to be safe under either a 30s or a 60s ingress, and can be raised once that value is known.',
      format: Number,
      default: 25000,
      env: 'BACKEND_VALIDATE_TIMEOUT_MS'
    }
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'Biodiversity Net Gain'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : []
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  session: {
    // Single source of truth for how long a user stays signed in. Expressed in
    // SECONDS (deployed environments override via SESSION_TTL_SECONDS) and
    // converted to ms once, in session-cache.js, where it drives BOTH the yar
    // cookie ttl and the server-side cache expiry so the two can never drift.
    // It is a sliding idle-timeout: every authenticated request renews the
    // window (auth-scheme.js), so only genuine inactivity for this long ends
    // the session — the IdP's much shorter (~20 min) token lifetime is bridged
    // by silent refresh in between.
    ttlSeconds: {
      doc: 'User session lifetime in seconds (sliding idle-timeout); drives both the session cookie ttl and the server-side cache ttl',
      format: Number,
      default: fourHoursSeconds,
      env: 'SESSION_TTL_SECONDS'
    },
    cache: {
      engine: {
        doc: 'backend cache is written to',
        format: ['redis', 'memory'],
        default: isProduction ? 'redis' : 'memory',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'server side session cache name',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_NAME'
      }
    },
    cookie: {
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  redis: {
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: '',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      default: '',
      sensitive: true,
      env: 'REDIS_PASSWORD'
    },
    keyPrefix: {
      doc: 'Redis cache key prefix name used to isolate the cached results across multiple clients',
      format: String,
      default: 'bng-metric-frontend:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster.',
      format: Boolean,
      default: !isProduction,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: isProduction,
      env: 'REDIS_TLS'
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  oidc: {
    discoveryUrl: {
      doc: 'OIDC provider discovery URL (.well-known/openid-configuration)',
      format: String,
      default:
        'http://localhost:3200/cdp-defra-id-stub/.well-known/openid-configuration',
      env: 'OIDC_DISCOVERY_URL'
    },
    clientId: {
      // Default below is the cdp-defra-id-stub's built-in client ID — not a
      // production credential. Deployed environments override via OIDC_CLIENT_ID.
      doc: 'OIDC client ID registered with the provider (stub default; deployed envs override via OIDC_CLIENT_ID)',
      format: String,
      default: '63983fc2-cfff-45bb-8ec2-959e21062b9a',
      env: 'OIDC_CLIENT_ID'
    },
    clientSecret: {
      doc: 'OIDC client secret',
      format: String,
      default: 'test_value',
      env: 'OIDC_CLIENT_SECRET',
      sensitive: true
    },
    redirectUri: {
      doc: 'OIDC redirect URI registered with the provider',
      format: String,
      default: 'http://localhost:3000/auth/callback',
      env: 'OIDC_REDIRECT_URI'
    },
    postLogoutRedirectUri: {
      doc: 'Post-logout landing URL sent to the provider end-session endpoint',
      format: String,
      default: 'http://localhost:3000/auth/signed-out',
      env: 'OIDC_POST_LOGOUT_REDIRECT_URI'
    },
    scopes: {
      doc: 'Space-separated OIDC scopes to request',
      format: String,
      default: 'openid profile email offline_access',
      env: 'OIDC_SCOPES'
    },
    serviceId: {
      doc: 'Defra ID service identifier passed in the authorization request',
      format: String,
      default: '',
      env: 'OIDC_SERVICE_ID'
    },
    useStub: {
      doc: 'True when the OIDC provider is the cdp-defra-id-stub. Live Defra ID (Azure AD B2C) requires the client ID appended to the scopes and includes nonce in the ID token; the stub does neither.',
      format: Boolean,
      default: false,
      env: 'OIDC_USE_STUB'
    }
  },
  useSwagger: {
    doc: 'Enable Swagger API documentation at /docs',
    format: Boolean,
    default: false,
    env: 'USE_SWAGGER'
  },
  appBaseUrl: {
    doc: 'Browser-facing base URL for this app. Used for upload redirect callbacks. Set to http://localhost:<port> locally, empty string in CDP cloud (relative URLs).',
    format: String,
    default: '',
    env: 'APP_BASE_URL'
  },
  cdpUploader: {
    url: {
      doc: 'Browser-facing base URL for the CDP uploader. Required locally, not needed in CDP cloud.',
      format: String,
      default: null,
      nullable: true,
      env: 'CDP_UPLOADER_URL'
    },
    bucket: {
      doc: 'S3 bucket for file uploads',
      format: String,
      default: 'baseline-files',
      env: 'CDP_UPLOADER_BUCKET'
    },
    s3Path: {
      doc: 'Path prefix within the S3 bucket for uploads',
      format: String,
      default: 'baseline/',
      env: 'CDP_UPLOADER_S3_PATH'
    }
  }
})

config.validate({ allowed: 'strict' })
