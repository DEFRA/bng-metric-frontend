import { createHmac } from 'node:crypto'

import { config } from '../../../../config/config.js'
import { buildAuthHeaders } from './build-auth-headers.js'

vi.mock('../../../../config/config.js', () => ({
  config: { get: vi.fn() }
}))

const SECRET = 'test-secret-123'
const TOKEN = 'header.payload.signature'

function expectedHeaders(token, secret) {
  const encodedToken = Buffer.from(token, 'utf8').toString('base64')
  const signature = createHmac('sha256', secret)
    .update(encodedToken)
    .digest('hex')
  return { encodedToken, signature }
}

beforeEach(() => {
  vi.mocked(config.get).mockReturnValue(SECRET)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('buildAuthHeaders', () => {
  test('returns base64 token and lowercase-hex HMAC headers', () => {
    const headers = buildAuthHeaders(TOKEN)
    const { encodedToken, signature } = expectedHeaders(TOKEN, SECRET)

    expect(headers).toEqual({
      'x-defra-id-token': encodedToken,
      'x-defra-id-signature': signature
    })
    expect(config.get).toHaveBeenCalledWith('auth.forwardSecret')
  })

  test('produces a deterministic, known signature for a known secret + token', () => {
    const headers = buildAuthHeaders(TOKEN)

    // base64('header.payload.signature') then HMAC-SHA256 keyed by SECRET.
    expect(headers['x-defra-id-token']).toBe('aGVhZGVyLnBheWxvYWQuc2lnbmF0dXJl')
    expect(headers['x-defra-id-signature']).toBe(
      '89fd360f17f97090145915314b94abf91f161d68d1cb8619fb71e5498177b5a1'
    )
  })

  test('signs the EXACT base64 token string (not the raw token)', () => {
    const headers = buildAuthHeaders(TOKEN)
    const overTheRawToken = createHmac('sha256', SECRET)
      .update(TOKEN)
      .digest('hex')

    expect(headers['x-defra-id-signature']).not.toBe(overTheRawToken)
  })

  test('signature is lowercase hex of the expected length', () => {
    const headers = buildAuthHeaders(TOKEN)
    expect(headers['x-defra-id-signature']).toMatch(/^[0-9a-f]{64}$/)
  })

  test('returns an empty object when there is no token', () => {
    expect(buildAuthHeaders(undefined)).toEqual({})
    expect(buildAuthHeaders('')).toEqual({})
    expect(config.get).not.toHaveBeenCalled()
  })

  test('never returns an Authorization / Bearer header', () => {
    const headers = buildAuthHeaders(TOKEN)
    expect(headers).not.toHaveProperty('Authorization')
  })
})
