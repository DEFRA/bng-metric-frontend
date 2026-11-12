import { Cluster, Redis } from 'ioredis'

import { createLogger } from './logging/logger.js'

/**
 * Refuse timeouts that would break every session read. A command timeout of 0
 * fails every command at once. A socket timeout at or below the command
 * timeout drops the whole connection for each slow command, not only that one.
 */
function assertRedisTimeouts({ commandTimeoutMs, socketTimeoutMs }) {
  if (!(commandTimeoutMs > 0) || !(socketTimeoutMs > commandTimeoutMs)) {
    throw new Error(
      `Invalid Redis timeouts: REDIS_COMMAND_TIMEOUT_MS (${commandTimeoutMs}) must be above 0, and REDIS_SOCKET_TIMEOUT_MS (${socketTimeoutMs}) must be above it`
    )
  }
}

/**
 * Setup Redis and provide a redis client
 *
 * Local development - 1 Redis instance
 * Environments - Elasticache / Redis Cluster with username and password
 */
export function buildRedisClient(redisConfig) {
  assertRedisTimeouts(redisConfig)
  const logger = createLogger()
  const port = 6379
  const db = 0
  const keyPrefix = redisConfig.keyPrefix
  const host = redisConfig.host
  let redisClient

  const credentials =
    redisConfig.username === ''
      ? {}
      : {
          username: redisConfig.username,
          password: redisConfig.password
        }
  const tls = redisConfig.useTLS ? { tls: {} } : {}
  // A Redis that accepts connections but never answers must fail a command,
  // not hold the page forever (BMD-1200). commandTimeout fails the one
  // command; socketTimeout then drops the connection, so the client
  // reconnects instead of matching late replies to the wrong commands. In
  // Cluster mode each node is a client built from redisOptions.
  const timeouts = {
    commandTimeout: redisConfig.commandTimeoutMs,
    socketTimeout: redisConfig.socketTimeoutMs
  }

  if (redisConfig.useSingleInstanceCache) {
    redisClient = new Redis({
      port,
      host,
      db,
      keyPrefix,
      ...timeouts,
      ...credentials,
      ...tls
    })
  } else {
    redisClient = new Cluster(
      [
        {
          host,
          port
        }
      ],
      {
        keyPrefix,
        slotsRefreshTimeout: 10000,
        dnsLookup: (address, callback) => callback(null, address),
        redisOptions: {
          db,
          ...timeouts,
          ...credentials,
          ...tls
        }
      }
    )
  }

  redisClient.on('connect', () => {
    logger.info('Connected to Redis server')
  })

  redisClient.on('error', (error) => {
    logger.error(`Redis connection error ${error}`)
  })

  return redisClient
}
