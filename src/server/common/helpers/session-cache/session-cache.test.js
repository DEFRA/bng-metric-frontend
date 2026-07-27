import { describe, expect, test, vi } from 'vitest'

import { sessionCache } from './session-cache.js'

// vi.hoisted so the value is available inside the (also hoisted) vi.mock factory.
const { TTL_SECONDS } = vi.hoisted(() => ({ TTL_SECONDS: 1800 }))
const MS_PER_SECOND = 1000

// session-cache.js reads the session config at module load; vitest hoists this
// mock above the import so the built options reflect a known ttlSeconds.
vi.mock('../../../../config/config.js', () => ({
  config: {
    get: (key) => {
      if (key === 'session') {
        return {
          ttlSeconds: TTL_SECONDS,
          cache: { name: 'session' },
          cookie: { password: 'a-password-at-least-32-characters-long' }
        }
      }
      // session.cookie.secure
      return false
    }
  }
}))

describe('sessionCache', () => {
  test('derives the cache expiry and cookie ttl from ttlSeconds (converted to ms)', () => {
    const expectedMs = TTL_SECONDS * MS_PER_SECOND
    expect(sessionCache.options.cache.expiresIn).toBe(expectedMs)
    expect(sessionCache.options.cookieOptions.ttl).toBe(expectedMs)
  })

  test('feeds one value to both so the cookie and cache TTLs cannot drift', () => {
    expect(sessionCache.options.cache.expiresIn).toBe(
      sessionCache.options.cookieOptions.ttl
    )
  })
})
