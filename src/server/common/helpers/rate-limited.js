import Boom from '@hapi/boom'

import { statusCodes } from '../constants.js'

const RETRY_AFTER_HEADER = 'retry-after'
const DECIMAL = 10

/**
 * Seconds from a `Retry-After` header that gives whole seconds, as the
 * backend's rate limit does. Null when there is none, or it is a date or not a
 * positive whole number: the page then gives no figure.
 *
 * @param {Record<string, string | string[]> | undefined} headers
 * @returns {number | null}
 */
export function retryAfterSeconds(headers) {
  const value = headers?.[RETRY_AFTER_HEADER]
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null
  }
  const seconds = Number.parseInt(value, DECIMAL)
  return seconds > 0 ? seconds : null
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
    retryAfterSeconds: retryAfterSeconds(headers)
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
