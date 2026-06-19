const SECONDS_PER_HOUR = 3600
const MILLIS_PER_SECOND = 1000

/**
 * Build a compact, structurally-valid id_token (`header.payload.signature`) for
 * tests. The signature segment is a placeholder — the forwarding path never
 * verifies it — but the payload carries a real, unexpired `exp` claim so the
 * pre-flight `isTokenCurrentlyValid` check treats it as forwardable.
 *
 * @param {Record<string, unknown>} [claims] extra claims to merge into the payload
 * @returns {string} a compact JWT string suitable for the yar session
 */
export function makeUnexpiredIdToken(claims = {}) {
  const nowSeconds = Math.floor(Date.now() / MILLIS_PER_SECOND)
  const header = encodeSegment({ alg: 'RS256', typ: 'JWT' })
  const payload = encodeSegment({
    sub: 'test-user',
    exp: nowSeconds + SECONDS_PER_HOUR,
    ...claims
  })
  return `${header}.${payload}.test-signature-not-verified`
}

function encodeSegment(object) {
  return Buffer.from(JSON.stringify(object)).toString('base64url')
}
