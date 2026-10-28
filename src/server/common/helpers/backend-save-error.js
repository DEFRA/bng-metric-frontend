import Boom from '@hapi/boom'

import { statusCodes } from '../constants.js'

/**
 * The status the backend answered a failed save with. wreck reports it on the
 * response for an error it raised from one, and on the Boom output otherwise.
 *
 * @param {unknown} err
 * @returns {number | undefined}
 */
export function backendStatusOf(err) {
  return err?.data?.res?.statusCode ?? err?.output?.statusCode
}

/**
 * The error to show for a habitat save the backend refused, so a refusal is not
 * reported as an upstream failure. An expired session passes through for
 * catchAll to handle (a redirect to sign in again).
 *
 * @param {unknown} err what backendRequest threw
 * @param {string} featureId
 * @returns {Error}
 */
export function backendSaveError(err, featureId) {
  if (err?.data?.sessionExpired) {
    return err
  }
  switch (backendStatusOf(err)) {
    case statusCodes.conflict:
      return Boom.conflict('Another user is editing this project')
    case statusCodes.notFound:
      return Boom.notFound(`Feature ${featureId} not found`)
    case statusCodes.badRequest:
      return Boom.badRequest('The habitat could not be saved')
    default:
      return Boom.badGateway('Failed to save habitat')
  }
}
