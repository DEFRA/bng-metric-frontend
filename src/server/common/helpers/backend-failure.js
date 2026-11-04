/**
 * Longest stretch of a raw response body worth quoting in a log line. Enough
 * for a proxy's error page title, short enough that a large page cannot flood
 * the log.
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
 * proxy in front of the backend would send. A response error carries the
 * response itself, in `data.isResponseError`. So does a response whose body
 * could not be read: wreck attaches it as `data.res` before rethrowing.
 *
 * - `response` — something answered with a 4xx or 5xx: the backend, or a proxy
 *   in front of it (its `server` header and body say which)
 * - `unreadable` — something answered, but its body would not parse as the
 *   JSON its content type promised, or stopped short. Wreck gives a body that
 *   will not parse a 502 of its own, whatever status actually came back.
 * - `timeout` — nothing answered before this side gave up
 * - `connection` — the connection failed: refused, reset or not resolvable
 * - `other` — anything else
 *
 * @param {object} error what wreck (or backendRequest) rejected with
 * @returns {'response'|'unreadable'|'timeout'|'connection'|'other'}
 */
function backendFailureKind(error) {
  if (error?.data?.isResponseError) {
    return 'response'
  }
  if (error?.data?.res) {
    return 'unreadable'
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
 * A response body as log text. JSON the backend sent is quoted whole, so a
 * long list of error codes keeps all of them. A body that is not JSON, such as
 * a proxy's error page, arrives as a Buffer, which JSON.stringify would turn
 * into an array of byte values: only its start is quoted, as text.
 */
function bodyText(payload) {
  if (payload === undefined || payload === null) {
    return 'none'
  }
  if (!Buffer.isBuffer(payload)) {
    return JSON.stringify(payload)
  }
  return payload
    .toString('utf8')
    .replaceAll(/\s+/g, ' ')
    .slice(0, BODY_SNIPPET_LENGTH)
}

/**
 * What answered: its status, content type, server and body. A response error
 * copies the headers to `data.headers`; an unreadable response has them only
 * on `data.res`.
 *
 * @param {{ headers?: object, res?: object, payload?: unknown }} data
 * @returns {string[]}
 */
function responseParts({ headers: dataHeaders, res, payload }) {
  const headers = dataHeaders ?? res?.headers ?? {}
  return [
    `responseStatusCode: ${res?.statusCode}`,
    `contentType: ${headers['content-type'] ?? 'none'}`,
    `server: ${headers.server ?? 'none'}`,
    `body: ${bodyText(payload)}`
  ]
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

  if (kind === 'response' || kind === 'unreadable') {
    // A body that would not parse is kept raw in `data.payload`; one that
    // stopped short leaves none.
    parts.push(...responseParts(error.data))
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
