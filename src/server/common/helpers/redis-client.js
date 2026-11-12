import { Cluster, Redis } from 'ioredis'

import { createLogger } from './logging/logger.js'

/**
 * Setup Redis and provide a redis client
 *
 * Local development - 1 Redis instance
 * Environments - Elasticache / Redis Cluster with username and password
 */
export function buildRedisClient(redisConfig) {
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
