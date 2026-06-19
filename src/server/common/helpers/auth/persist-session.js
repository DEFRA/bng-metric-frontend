import { config } from '../../../../config/config.js'
import { statusCodes } from '../../constants.js'
import { wreck } from '../wreck-client.js'
import { recordSessionPersistFailure } from './auth-metrics.js'
import { buildAuthHeaders } from './build-auth-headers.js'

const backendUrl = config.get('backend').url

/**
 * Best-effort: tell the backend to persist the authenticated user's identity,
 * relationships and roles by POSTing the id_token to `{backend}/auth/session`.
 * A failure here must NOT block sign-in — we log, record a metric, and let the
 * caller continue to redirect the user. Never logs the token or claims (PII).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} idToken the OIDC id_token to forward (signed, not as Bearer)
 * @returns {Promise<void>}
 */
export async function persistBackendSession(request, idToken) {
  if (!idToken) {
    return
  }
  try {
    const { res } = await wreck.post(`${backendUrl}/auth/session`, {
      headers: buildAuthHeaders(idToken)
    })
    if (res.statusCode >= statusCodes.badRequest) {
      request.logger.warn(
        { statusCode: res.statusCode },
        'Backend session persist returned a non-success status; continuing'
      )
      await recordSessionPersistFailure(request)
    }
  } catch (error) {
    request.logger.warn(
      { err: error.message },
      'Backend session persist failed; continuing to sign in'
    )
    await recordSessionPersistFailure(request)
  }
}
