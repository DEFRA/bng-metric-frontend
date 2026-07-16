import { config } from '../../../../config/config.js'
import { statusCodes } from '../../constants.js'
import { wreck } from '../wreck-client.js'
import { recordLoginAuditFailure } from './auth-metrics.js'

const backendUrl = config.get('backend').url

/**
 * Best-effort: append an immutable login-audit row for the authenticated user by
 * POSTing the id_token to `{backend}/auth/login-audit`. The backend verifies the
 * token and records the login (email, name, currentRelationshipId, session id,
 * UTC timestamp) from the verified claims. A failure here must NOT block sign-in —
 * we log, record a metric, and let the caller continue to redirect the user.
 * Never logs the token or claims (PII).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} idToken the OIDC id_token to forward as a Bearer credential
 * @returns {Promise<void>}
 */
export async function recordLoginAudit(request, idToken) {
  if (!idToken) {
    return
  }
  try {
    const { res } = await wreck.post(`${backendUrl}/auth/login-audit`, {
      headers: { Authorization: `Bearer ${idToken}` }
    })
    if (res.statusCode >= statusCodes.badRequest) {
      request.logger.warn(
        { statusCode: res.statusCode },
        'Backend login audit returned a non-success status; continuing'
      )
      await recordLoginAuditFailure(request)
    }
  } catch (error) {
    request.logger.warn(
      { err: error.message },
      'Backend login audit failed; continuing to sign in'
    )
    await recordLoginAuditFailure(request)
  }
}
