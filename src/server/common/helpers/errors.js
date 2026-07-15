import { statusCodes } from '../constants.js'
import { SESSION_EXPIRED_PATH } from './auth/session-expiry.js'

function statusCodeMessage(statusCode) {
  switch (statusCode) {
    case statusCodes.notFound:
      return 'Page not found'
    case statusCodes.forbidden:
      return 'Forbidden'
    case statusCodes.unauthorized:
      return 'Unauthorized'
    case statusCodes.badRequest:
      return 'Bad Request'
    case statusCodes.conflict:
      return 'Another user is editing this. Please try again.'
    default:
      return 'Something went wrong'
  }
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
  const errorMessage = statusCodeMessage(statusCode)

  if (statusCode >= statusCodes.internalServerError) {
    request.logger.error(response?.stack)
  }

  return h
    .view('error/index', {
      pageTitle: errorMessage,
      heading: statusCode,
      message: errorMessage
    })
    .code(statusCode)
}
