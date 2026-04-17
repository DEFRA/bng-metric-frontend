import { Cluster, Redis } from 'ioredis'

import { config } from '../../../config/config.js'
import { buildRedisClient } from './redis-client.js'

const eventHandlers = {}

vi.mock('ioredis', () => ({
  ...vi.importActual('ioredis'),
  Cluster: vi.fn(function () {
    return {
      on: (event, handler) => {
        eventHandlers[event] = handler
      }
    }
  }),
  Redis: vi.fn(function () {
    return {
      on: (event, handler) => {
        eventHandlers[event] = handler
      }
    }
  })
}))

describe('#buildRedisClient', () => {
  describe('When Redis Single InstanceCache is requested', () => {
    beforeEach(() => {
      buildRedisClient(config.get('redis'))
    })

    test('Should instantiate a single Redis client', () => {
      expect(Redis).toHaveBeenCalledWith({
        db: 0,
        host: '127.0.0.1',
        keyPrefix: 'bng-metric-frontend:',
        port: 6379
      })
    })

    test('Should log on connect', () => {
      expect(eventHandlers.connect).toBeDefined()
      eventHandlers.connect()
    })

    test('Should log on error', () => {
      expect(eventHandlers.error).toBeDefined()
      eventHandlers.error(new Error('connection refused'))
    })
  })

  describe('When a Redis Cluster is requested', () => {
    beforeEach(() => {
      buildRedisClient({
        ...config.get('redis'),
        useSingleInstanceCache: false,
        useTLS: true,
        username: 'user',
        password: 'pass'
      })
    })

    test('Should instantiate a Redis Cluster client', () => {
      expect(Cluster).toHaveBeenCalledWith(
        [{ host: '127.0.0.1', port: 6379 }],
        {
          dnsLookup: expect.any(Function),
          keyPrefix: 'bng-metric-frontend:',
          redisOptions: { db: 0, password: 'pass', tls: {}, username: 'user' },
          slotsRefreshTimeout: 10000
        }
      )
    })

    test('Should resolve dnsLookup with the address', () => {
      const clusterOptions = Cluster.mock.calls[0][1]
      const callback = vi.fn()

      clusterOptions.dnsLookup('redis.example.com', callback)

      expect(callback).toHaveBeenCalledWith(null, 'redis.example.com')
    })
  })
})
