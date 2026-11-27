import Boom from '@hapi/boom'

import { statusCodes } from '../constants.js'
import { retryAfterSeconds } from './rate-limited.js'

/**
 * The error for work the backend refused with a 503 and a `Retry-After`
 * because it was busy with other people's, such as building the metric
 * spreadsheet. It carries the backend's wait, which `catchAll` shows on the
 * "Sorry, the service is busy" page.
 *
 * Like a rate limit, it is not a failure: the backend answered as it should,
 * so the page is not logged as an error.
 *
 * @param {Record<string, string | string[]> | undefined} headers the
 *   backend's response headers
 */
export function serviceBusyError(headers) {
  return Boom.serverUnavailable('The backend was busy: try again', {
    serviceBusy: true,
    retryAfterSeconds: retryAfterSeconds(headers)
  })
}

/**
 * {@link serviceBusyError} when the backend's response is a 503 with a
 * usable `Retry-After`, else null.
 *
 * The wait is what marks a busy refusal: the backend always sends one when it
 * is busy. A 503 without one is more likely a proxy in front of a backend that
 * is down, which is an outage to log, not a page asking the user to wait.
 *
 * @param {{ statusCode?: number, headers?: object } | null | undefined} res
 */
export function serviceBusyErrorFor(res) {
  return res?.statusCode === statusCodes.serviceUnavailable &&
    retryAfterSeconds(res.headers) !== null
    ? serviceBusyError(res.headers)
    : null
}

/**
 * Whether `error` is {@link serviceBusyError}'s.
 *
 * @param {unknown} error
 */
export function isServiceBusy(error) {
  return error?.data?.serviceBusy === true
}
