import Boom from '@hapi/boom'

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
 * Whether `error` is {@link serviceBusyError}'s.
 *
 * @param {unknown} error
 */
export function isServiceBusy(error) {
  return error?.data?.serviceBusy === true
}
