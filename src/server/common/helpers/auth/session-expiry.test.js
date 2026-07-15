import { describe, expect, test, vi } from 'vitest'

import {
  SESSION_EXPIRED_PATH,
  expireSession,
  isSessionExpired
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
    const request = { yar: { reset: vi.fn() } }
    expireSession(request)
    expect(request.yar.reset).toHaveBeenCalledTimes(1)
  })

  test('tolerates a request without yar', () => {
    expect(() => expireSession({})).not.toThrow()
  })
})

describe('SESSION_EXPIRED_PATH', () => {
  test('points at the session-expired page', () => {
    expect(SESSION_EXPIRED_PATH).toBe('/auth/session-expired')
  })
})
