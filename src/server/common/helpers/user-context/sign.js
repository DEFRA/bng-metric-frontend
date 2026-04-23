import { createHmac } from 'node:crypto'

import { currentEpoch, deriveKey } from './derive-key.js'

export function signUserContext(
  userId,
  sid,
  { rootSecret, periodSeconds, tokenTtlSeconds, now = Date.now() }
) {
  const epoch = currentEpoch(periodSeconds, now)
  const iat = Math.floor(now / 1000)
  const payload = {
    userId,
    sid,
    iat,
    exp: iat + tokenTtlSeconds,
    epoch
  }

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const key = deriveKey(rootSecret, epoch)
  const sig = createHmac('sha256', key).update(body).digest().toString('base64url')

  return `${body}.${sig}`
}
