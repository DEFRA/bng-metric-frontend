import Boom from '@hapi/boom'

import { statusCodes } from '../constants.js'

const RETRY_AFTER_HEADER = 'retry-after'
const DECIMAL = 10

/**
 * The longest wait the "too many requests" page states. The backend's windows
 * are a minute by default; a longer figure is more likely a misconfigured
 * header than a wait worth printing, so the page gives no figure instead.
 */
const MAX_SHOWN_WAIT_SECONDS = 300

/**
 * Seconds from a `Retry-After` header, or null if it does not carry a usable
 * one. The one parser for every `Retry-After` the frontend honours.
 *
 * Only whole delta-seconds are understood: the backend always sends them, and
 * guessing at an HTTP-date would be more code than the fallback it saves. A
 * value of 0, or over `max`, is null too: the header comes from another
 * service, so it is a hint, and each caller has its own fallback.
 *
 * @param {Record<string, string | string[]> | undefined} headers response
 *   headers, lower-cased as Node delivers them
 * @param {{ max?: number }} [bounds]
 * @returns {number | null}
 */
export function retryAfterSeconds(headers, { max = Infinity } = {}) {
  const value = headers?.[RETRY_AFTER_HEADER]
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null
  }
  const seconds = Number.parseInt(value, DECIMAL)
  return seconds > 0 && seconds <= max ? seconds : null
}

/**
 * The error for a request the backend refused with 429: one of its rate
 * limits, for this user or for all users, is over. It carries the wait the
 * backend gave, which `catchAll` shows on the "too many requests" page.
 *
 * Not a backend failure: the backend answered as it should. A caller passes
 * it on rather than logging it as one.
 *
 * @param {Record<string, string | string[]> | undefined} headers
 */
export function rateLimitedError(headers) {
  return Boom.tooManyRequests('The backend refused the request: rate limit', {
    rateLimited: true,
    retryAfterSeconds: retryAfterSeconds(headers, {
      max: MAX_SHOWN_WAIT_SECONDS
    })
  })
}

/**
 * Whether `error` is {@link rateLimitedError}'s.
 *
 * @param {unknown} error
 */
export function isRateLimited(error) {
  return error?.data?.rateLimited === true
}

/**
 * {@link rateLimitedError} when the backend's response is a 429, else null.
 * Wreck gives a 4xx either as the response or, from its shortcut methods, as
 * an error carrying it in `data.res`, so a caller checks whichever it got.
 *
 * @param {{ statusCode?: number, headers?: object } | undefined} res
 */
export function rateLimitedErrorFor(res) {
  return res?.statusCode === statusCodes.tooManyRequests
    ? rateLimitedError(res.headers)
    : null
}
