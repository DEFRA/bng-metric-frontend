/**
 * Longest stretch of a response body worth quoting in a log line. Enough for a
 * proxy's error page title or the start of an unexpected JSON body, short
 * enough that a large page cannot flood the log.
 */
const BODY_SNIPPET_LENGTH = 300

const WRECK_TIMEOUT_MESSAGE = 'Client request timeout'
// A prefix: Boom puts the socket error's own message after it.
const WRECK_REQUEST_ERROR_MESSAGE = 'Client request error'

/**
 * What kind of failure a rejected backend call was.
 *
 * Wreck reports its own failures with HTTP status codes of their own, so the
 * status code alone cannot tell them apart from a real response: a timeout
 * here is a 504 and a dropped or refused connection a 502, the same codes a
 * proxy in front of the backend would send. Only a response error carries the
 * response itself, in `data.isResponseError`.
 *
 * - `response` — something answered with a 4xx or 5xx: the backend, or a proxy
 *   in front of it (its `server` header and body say which)
 * - `timeout` — nothing answered before this side gave up
 * - `connection` — the connection failed: refused, reset or not resolvable
 * - `other` — anything else, such as a payload that would not parse
 *
 * @param {object} error what wreck (or backendRequest) rejected with
 * @returns {'response'|'timeout'|'connection'|'other'}
 */
function backendFailureKind(error) {
  if (error?.data?.isResponseError) {
    return 'response'
  }
  if (error?.message === WRECK_TIMEOUT_MESSAGE) {
    return 'timeout'
  }
  if (error?.message?.startsWith(WRECK_REQUEST_ERROR_MESSAGE)) {
    return 'connection'
  }
  return 'other'
}

/**
 * The start of a body that is not the JSON the backend sends, as text. A
 * proxy's error page arrives as a Buffer, which JSON.stringify would turn into
 * an array of byte values.
 */
function bodySnippet(payload) {
  if (payload === undefined || payload === null) {
    return 'none'
  }
  const text = Buffer.isBuffer(payload)
    ? payload.toString('utf8')
    : JSON.stringify(payload)
  return text.replaceAll(/\s+/g, ' ').slice(0, BODY_SNIPPET_LENGTH)
}

/**
 * A log fragment saying what a failed backend call actually was, for the
 * message text: CDP's log ingestion keeps the message, but can drop structured
 * fields it does not allowlist.
 *
 * @param {object} error what wreck (or backendRequest) rejected with
 * @param {{ elapsedMs: number, timeoutMs: number }} timing
 * @returns {string}
 */
function describeBackendFailure(error, { elapsedMs, timeoutMs }) {
  const kind = backendFailureKind(error)
  const parts = [
    `failure: ${kind}`,
    `elapsedMs: ${Math.round(elapsedMs)}`,
    `timeoutMs: ${timeoutMs}`
  ]

  if (kind === 'response') {
    const headers = error.data.headers ?? {}
    parts.push(
      `responseStatusCode: ${error.data.res?.statusCode}`,
      `contentType: ${headers['content-type'] ?? 'none'}`,
      `server: ${headers.server ?? 'none'}`,
      `body: ${bodySnippet(error.data.payload)}`
    )
  }

  if (kind === 'connection') {
    // Boom wraps the socket error in place, so it keeps its own code —
    // ECONNRESET, ECONNREFUSED, ENOTFOUND, EPIPE and the like — and its
    // message is already on the end of the error's.
    parts.push(`errorCode: ${error.code ?? 'none'}`)
  }

  if (kind === 'other') {
    parts.push(`errorName: ${error?.name ?? 'none'}`)
  }

  return parts.join(', ')
}

export { backendFailureKind, describeBackendFailure }
