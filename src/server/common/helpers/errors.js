import { statusCodes } from '../constants.js'
import { SESSION_EXPIRED_PATH } from './auth/session-expiry.js'
import { pageErrorText } from '../error-text/error-text.js'

// The pages section's page for each status; any other is serverError. A 422,
// a save the backend refused under one of the service's rules, shows the same
// page as a 400.
const STATUS_PAGES = new Map([
  [statusCodes.notFound, 'notFound'],
  [statusCodes.forbidden, 'forbidden'],
  [statusCodes.unauthorized, 'unauthorized'],
  [statusCodes.badRequest, 'badRequest'],
  [statusCodes.unprocessableEntity, 'badRequest'],
  [statusCodes.conflict, 'conflict']
])

const SERVER_ERROR_PAGE = pageErrorText('serverError')
const ERROR_PAGES = new Map(
  [...STATUS_PAGES].map(([status, key]) => [status, pageErrorText(key)])
)

function statusCodePage(statusCode) {
  return ERROR_PAGES.get(statusCode) ?? SERVER_ERROR_PAGE
}

/**
 * The "too many requests" page for the wait the backend gave, in seconds: a
 * page for each grammatical form, and one for no wait at all.
 *
 * @param {number | null | undefined} seconds
 */
export function tooManyRequestsPage(seconds) {
  if (!seconds) {
    return pageErrorText('tooManyRequestsNoWait')
  }
  if (seconds === 1) {
    return pageErrorText('tooManyRequestsOneSecond')
  }
  return pageErrorText('tooManyRequests', { seconds })
}

/**
 * A backend rate limit refused the request (rate-limited.js). The page says
 * how long to wait, and so does the Retry-After header. It is not logged: the
 * service did what it should.
 */
function renderTooManyRequests(response, h) {
  const seconds = response.data?.retryAfterSeconds
  const page = tooManyRequestsPage(seconds)
  const view = h
    .view('error/index', {
      pageTitle: page.title,
      heading: statusCodes.tooManyRequests,
      message: page.title,
      body: page.body
    })
    .code(statusCodes.tooManyRequests)
  if (seconds) {
    view.header('Retry-After', String(seconds))
  }
  return view
}

export function catchAll(request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  // A backend call found the session's tokens dead and unrefreshable
  // (backend-request.js). Send the user to sign in again instead of
  // rendering a bare "401 Unauthorized" error page. (BMD-829)
  if (response.data?.sessionExpired) {
    return h.redirect(SESSION_EXPIRED_PATH)
  }

  const statusCode = response.output.statusCode
  if (statusCode === statusCodes.tooManyRequests) {
    return renderTooManyRequests(response, h)
  }

  const page = statusCodePage(statusCode)

  if (statusCode >= statusCodes.internalServerError) {
    request.logger.error(response?.stack)
  }

  return h
    .view('error/index', {
      pageTitle: page.title,
      heading: statusCode,
      message: page.title,
      body: page.body
    })
    .code(statusCode)
}
