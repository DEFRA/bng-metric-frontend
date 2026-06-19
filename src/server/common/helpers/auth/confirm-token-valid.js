const CLOCK_SKEW_SECONDS = 60
const MILLIS_PER_SECOND = 1000
const JWT_PART_COUNT = 3
const PAYLOAD_INDEX = 1

/**
 * Read the `exp` (and `nbf`, if present) claims from a compact JWT WITHOUT
 * verifying its signature, and decide whether it is currently within its
 * validity window allowing for a small clock skew. Used as a pre-flight check
 * before forwarding the token to the backend so we never forward an expired
 * token. Malformed/undecodable tokens are treated as invalid.
 *
 * Never logs the token or its claims (PII).
 *
 * @param {string|undefined|null} idToken raw compact id_token
 * @returns {boolean} true when the token is unexpired and already valid
 */
export function isTokenCurrentlyValid(idToken) {
  const claims = decodeClaims(idToken)
  if (!claims) {
    return false
  }

  const nowSeconds = Math.floor(Date.now() / MILLIS_PER_SECOND)

  if (
    typeof claims.exp === 'number' &&
    nowSeconds >= claims.exp + CLOCK_SKEW_SECONDS
  ) {
    return false
  }
  if (
    typeof claims.nbf === 'number' &&
    nowSeconds < claims.nbf - CLOCK_SKEW_SECONDS
  ) {
    return false
  }

  return true
}

/**
 * Decode the JWT payload to a claims object. Returns null on any malformed
 * input rather than throwing.
 *
 * @param {string|undefined|null} idToken
 * @returns {Record<string, unknown>|null}
 */
function decodeClaims(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    return null
  }
  const parts = idToken.split('.')
  if (parts.length !== JWT_PART_COUNT) {
    return null
  }
  try {
    const json = Buffer.from(parts[PAYLOAD_INDEX], 'base64url').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}
