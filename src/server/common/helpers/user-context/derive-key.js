import { hkdfSync } from 'node:crypto'

const KEY_LENGTH_BYTES = 32
const HKDF_INFO_PREFIX = 'bng-ctx-v1:'

export function currentEpoch(periodSeconds, now = Date.now()) {
  return Math.floor(now / 1000 / periodSeconds)
}

export function deriveKey(rootSecret, epoch) {
  const info = `${HKDF_INFO_PREFIX}${epoch}`
  const derived = hkdfSync(
    'sha256',
    rootSecret,
    Buffer.alloc(0),
    info,
    KEY_LENGTH_BYTES
  )
  return Buffer.from(derived)
}
