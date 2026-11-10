import { statusCodes } from '../constants.js'
import { SESSION_EXPIRED_PATH } from './auth/session-expiry.js'
import { pageErrorText } from '../error-text/error-text.js'

// The pages section's page for each status; any other is serverError. A 401
// has no page: a dead session redirects to sign in before it gets here.
const STATUS_PAGES = new Map([
  [statusCodes.notFound, 'notFound'],
  [statusCodes.forbidden, 'forbidden'],
  [statusCodes.badRequest, 'badRequest'],
  [statusCodes.conflict, 'conflict']
])

const SERVER_ERROR_PAGE = pageErrorText('serverError')
const ERROR_PAGES = new Map(
  [...STATUS_PAGES].map(([status, key]) => [status, pageErrorText(key)])
)

function statusCodePage(statusCode) {
  return ERROR_PAGES.get(statusCode) ?? SERVER_ERROR_PAGE
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
