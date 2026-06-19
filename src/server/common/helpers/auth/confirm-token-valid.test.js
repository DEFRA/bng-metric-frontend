import { isTokenCurrentlyValid } from './confirm-token-valid.js'

const NOW_SECONDS = 1_700_000_000
const ONE_HOUR = 3600
const TWO_MINUTES = 120
const THIRTY_SECONDS = 30

function makeToken(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString(
    'base64url'
  )
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${header}.${payload}.signature-not-verified`
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW_SECONDS * 1000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isTokenCurrentlyValid', () => {
  test('returns true for an unexpired token', () => {
    expect(
      isTokenCurrentlyValid(makeToken({ exp: NOW_SECONDS + ONE_HOUR }))
    ).toBe(true)
  })

  test('returns false for a clearly expired token', () => {
    expect(
      isTokenCurrentlyValid(makeToken({ exp: NOW_SECONDS - ONE_HOUR }))
    ).toBe(false)
  })

  test('allows a token expired within the clock-skew window', () => {
    expect(
      isTokenCurrentlyValid(makeToken({ exp: NOW_SECONDS - THIRTY_SECONDS }))
    ).toBe(true)
  })

  test('rejects a token expired beyond the clock-skew window', () => {
    expect(
      isTokenCurrentlyValid(makeToken({ exp: NOW_SECONDS - TWO_MINUTES }))
    ).toBe(false)
  })

  test('rejects a not-yet-valid token (nbf in the future)', () => {
    expect(
      isTokenCurrentlyValid(
        makeToken({
          exp: NOW_SECONDS + ONE_HOUR,
          nbf: NOW_SECONDS + TWO_MINUTES
        })
      )
    ).toBe(false)
  })

  test('accepts an nbf within the clock-skew window', () => {
    expect(
      isTokenCurrentlyValid(
        makeToken({
          exp: NOW_SECONDS + ONE_HOUR,
          nbf: NOW_SECONDS + THIRTY_SECONDS
        })
      )
    ).toBe(true)
  })

  test('treats a token with no exp claim as valid', () => {
    expect(isTokenCurrentlyValid(makeToken({ sub: 'u1' }))).toBe(true)
  })

  test.each([undefined, null, '', 'not-a-jwt', 'only.two'])(
    'returns false for malformed input %p',
    (value) => {
      expect(isTokenCurrentlyValid(value)).toBe(false)
    }
  )

  test('returns false when the payload is not valid JSON', () => {
    const token = `${Buffer.from('{}').toString('base64url')}.@@@.sig`
    expect(isTokenCurrentlyValid(token)).toBe(false)
  })
})
