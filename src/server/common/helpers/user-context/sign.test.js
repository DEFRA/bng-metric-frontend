import { createHmac } from 'node:crypto'

import { currentEpoch, deriveKey } from './derive-key.js'
import { signUserContext } from './sign.js'

const ROOT = 'unit-test-root-secret'
const PERIOD = 3600
const TTL = 60
const NOW = 7200_000

describe('#signUserContext', () => {
  test('Should produce a body.sig string', () => {
    const token = signUserContext('user-1', 'sid-1', {
      rootSecret: ROOT,
      periodSeconds: PERIOD,
      tokenTtlSeconds: TTL,
      now: NOW
    })

    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(2)
  })

  test('Should embed userId, sid, iat, exp, epoch in the payload', () => {
    const token = signUserContext('user-1', 'sid-1', {
      rootSecret: ROOT,
      periodSeconds: PERIOD,
      tokenTtlSeconds: TTL,
      now: NOW
    })

    const [body] = token.split('.')
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))

    expect(payload).toEqual({
      userId: 'user-1',
      sid: 'sid-1',
      iat: Math.floor(NOW / 1000),
      exp: Math.floor(NOW / 1000) + TTL,
      epoch: currentEpoch(PERIOD, NOW)
    })
  })

  test('Should produce a signature that matches manual HMAC over the body', () => {
    const token = signUserContext('user-1', 'sid-1', {
      rootSecret: ROOT,
      periodSeconds: PERIOD,
      tokenTtlSeconds: TTL,
      now: NOW
    })

    const [body, sig] = token.split('.')
    const epoch = currentEpoch(PERIOD, NOW)
    const expected = createHmac('sha256', deriveKey(ROOT, epoch))
      .update(body)
      .digest()
      .toString('base64url')

    expect(sig).toBe(expected)
  })

  test('Should be deterministic for fixed inputs', () => {
    const opts = {
      rootSecret: ROOT,
      periodSeconds: PERIOD,
      tokenTtlSeconds: TTL,
      now: NOW
    }
    const a = signUserContext('user-1', 'sid-1', opts)
    const b = signUserContext('user-1', 'sid-1', opts)
    expect(a).toBe(b)
  })
})
