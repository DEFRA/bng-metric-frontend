import { describe, expect, test, vi } from 'vitest'

import {
  SESSION_ENDED_KEY,
  SESSION_EXPIRED_PATH,
  SESSION_SLID_AT_KEY,
  SESSION_SLIDE_INTERVAL_SECONDS,
  clearSessionEnded,
  expireSession,
  isSessionExpired,
  touchSession,
  wasSessionEnded
} from './session-expiry.js'

const NOW_MS = 1_750_000_000_000
const NOW_SECONDS = NOW_MS / 1000
const ONE_HOUR_SECONDS = 3600

function sessionWithExp(exp) {
  return { user: { sub: 'u1', exp } }
}

describe('isSessionExpired', () => {
  test('is false when the token expires comfortably in the future', () => {
    const session = sessionWithExp(NOW_SECONDS + ONE_HOUR_SECONDS)
    expect(isSessionExpired(session, NOW_MS)).toBe(false)
  })

  test('is true when the exp claim has passed', () => {
    const session = sessionWithExp(NOW_SECONDS - 1)
    expect(isSessionExpired(session, NOW_MS)).toBe(true)
  })

  test('is true inside the leeway window just before expiry', () => {
    const session = sessionWithExp(NOW_SECONDS + 10)
    expect(isSessionExpired(session, NOW_MS)).toBe(true)
  })

  test('is false just outside the leeway window', () => {
    const session = sessionWithExp(NOW_SECONDS + 31)
    expect(isSessionExpired(session, NOW_MS)).toBe(false)
  })

  test('treats a missing exp claim as expired', () => {
    expect(isSessionExpired({ user: { sub: 'u1' } }, NOW_MS)).toBe(true)
  })

  test('treats a non-numeric exp claim as expired', () => {
    expect(isSessionExpired(sessionWithExp('tomorrow'), NOW_MS)).toBe(true)
  })

  test('treats a missing session or user as expired', () => {
    expect(isSessionExpired(undefined, NOW_MS)).toBe(true)
    expect(isSessionExpired(null, NOW_MS)).toBe(true)
    expect(isSessionExpired({}, NOW_MS)).toBe(true)
  })

  test('defaults to the current clock when no time is injected', () => {
    expect(isSessionExpired(sessionWithExp(0))).toBe(true)
  })
})

describe('expireSession', () => {
  test('resets the whole yar session so an old cookie cannot resurrect it', () => {
    const request = { yar: { reset: vi.fn(), set: vi.fn() } }
    expireSession(request)
    expect(request.yar.reset).toHaveBeenCalledTimes(1)
  })

  test('leaves a sessionEnded breadcrumb in the fresh session', () => {
    const request = { yar: { reset: vi.fn(), set: vi.fn() } }
    expireSession(request)
    expect(request.yar.set).toHaveBeenCalledWith(SESSION_ENDED_KEY, true)
  })

  test('resets before dropping the breadcrumb so it lands in the fresh session', () => {
    const calls = []
    const request = {
      yar: {
        reset: vi.fn(() => calls.push('reset')),
        set: vi.fn(() => calls.push('set'))
      }
    }
    expireSession(request)
    expect(calls).toEqual(['reset', 'set'])
  })

  test('tolerates a request without yar', () => {
    expect(() => expireSession({})).not.toThrow()
  })
})

describe('touchSession', () => {
  function makeRequest(store) {
    return {
      yar: {
        get: vi.fn((key) => store[key]),
        set: vi.fn((key, value) => {
          store[key] = value
        })
      }
    }
  }

  test('renews the sliding TTL (writes the throttle timestamp) on first touch', () => {
    const request = makeRequest({ auth: { user: { sub: 'u1' } } })

    touchSession(request, NOW_SECONDS * 1000)

    expect(request.yar.set).toHaveBeenCalledWith(
      SESSION_SLID_AT_KEY,
      NOW_SECONDS
    )
  })

  test('skips the write when renewed within the throttle window', () => {
    const request = makeRequest({
      auth: { user: { sub: 'u1' } },
      [SESSION_SLID_AT_KEY]: NOW_SECONDS
    })

    // One second before the interval elapses.
    const nowMs = (NOW_SECONDS + SESSION_SLIDE_INTERVAL_SECONDS - 1) * 1000
    touchSession(request, nowMs)

    expect(request.yar.set).not.toHaveBeenCalled()
  })

  test('renews again once the throttle interval has elapsed', () => {
    const request = makeRequest({
      auth: { user: { sub: 'u1' } },
      [SESSION_SLID_AT_KEY]: NOW_SECONDS
    })

    const laterSeconds = NOW_SECONDS + SESSION_SLIDE_INTERVAL_SECONDS
    touchSession(request, laterSeconds * 1000)

    expect(request.yar.set).toHaveBeenCalledWith(
      SESSION_SLID_AT_KEY,
      laterSeconds
    )
  })

  test('does nothing when there is no authenticated session to renew', () => {
    const request = makeRequest({})

    touchSession(request, NOW_SECONDS * 1000)

    expect(request.yar.set).not.toHaveBeenCalled()
  })

  test('tolerates a request without yar', () => {
    expect(() => touchSession({}, NOW_SECONDS * 1000)).not.toThrow()
  })
})

describe('wasSessionEnded', () => {
  test('is true when the breadcrumb is present', () => {
    const request = { yar: { get: vi.fn().mockReturnValue(true) } }
    expect(wasSessionEnded(request)).toBe(true)
    expect(request.yar.get).toHaveBeenCalledWith(SESSION_ENDED_KEY)
  })

  test('is false when the breadcrumb is absent', () => {
    const request = { yar: { get: vi.fn().mockReturnValue(undefined) } }
    expect(wasSessionEnded(request)).toBe(false)
  })

  test('is false when the request has no yar', () => {
    expect(wasSessionEnded({})).toBe(false)
  })
})

describe('clearSessionEnded', () => {
  test('clears the breadcrumb key', () => {
    const request = { yar: { clear: vi.fn() } }
    clearSessionEnded(request)
    expect(request.yar.clear).toHaveBeenCalledWith(SESSION_ENDED_KEY)
  })

  test('tolerates a request without yar', () => {
    expect(() => clearSessionEnded({})).not.toThrow()
  })
})

describe('SESSION_EXPIRED_PATH', () => {
  test('points at the session-expired page', () => {
    expect(SESSION_EXPIRED_PATH).toBe('/auth/session-expired')
  })
})
