import { createHmac } from 'node:crypto'

import { config } from '../../../../config/config.js'

const TOKEN_HEADER = 'x-defra-id-token'
const SIGNATURE_HEADER = 'x-defra-id-signature'
const HMAC_ALGORITHM = 'sha256'
const TOKEN_ENCODING = 'base64'
const SIGNATURE_ENCODING = 'hex'

/**
 * Build the signed forwarding headers for a backend call from a raw compact
 * Defra ID id_token (the `header.payload.signature` string stored in session):
 *
 *   - `x-defra-id-token`: standard base64 of the compact JWT string.
 *   - `x-defra-id-signature`: lowercase-hex HMAC-SHA256 over the EXACT base64
 *     token string, keyed by the shared `AUTH_FORWARD_SECRET`.
 *
 * The backend recomputes the HMAC and compares in constant time. Returns an
 * empty object when there is no token so the header spread is always safe.
 * Never logs the token, signature, or secret.
 *
 * @param {string|undefined|null} idToken the raw compact id_token from session
 * @returns {{ 'x-defra-id-token': string, 'x-defra-id-signature': string } | {}}
 */
export function buildAuthHeaders(idToken) {
  if (!idToken) {
    return {}
  }

  const secret = config.get('auth.forwardSecret')
  const encodedToken = Buffer.from(idToken, 'utf8').toString(TOKEN_ENCODING)
  const signature = createHmac(HMAC_ALGORITHM, secret)
    .update(encodedToken)
    .digest(SIGNATURE_ENCODING)

  return {
    [TOKEN_HEADER]: encodedToken,
    [SIGNATURE_HEADER]: signature
  }
}
