import { refreshTokenGrant } from 'openid-client'

import { getOidcConfig } from './oidc-client.js'

/**
 * Attempt a silent token refresh using the refresh_token stored in the yar
 * session. On success the new id_token / refresh_token (and refreshed claims)
 * are written back to the session and the new id_token is returned. On any
 * failure — no refresh token, or the IdP rejecting the grant — it returns null
 * and the caller falls back to re-authentication.
 *
 * Never logs token contents or claims (PII).
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<string|null>} the new id_token, or null on failure
 */
export async function refreshSession(request) {
  const auth = request.yar?.get('auth')
  const refreshToken = auth?.refreshToken
  if (!refreshToken) {
    return null
  }

  try {
    const oidcConfig = await getOidcConfig()
    const tokens = await refreshTokenGrant(oidcConfig, refreshToken)
    const claims = tokens.claims()

    request.yar.set('auth', {
      // Merge over the previous claims: a provider may omit claims from a
      // refreshed id_token (roles, relationships, …) and losing them here
      // would flip the role check to /auth/forbidden after a silent refresh.
      user: claims ? { ...auth.user, ...claims } : auth.user,
      idToken: tokens.id_token,
      // Some providers omit a new refresh token on refresh — keep the old one.
      refreshToken: tokens.refresh_token ?? refreshToken
    })

    request.logger?.info(
      { sub: claims?.sub },
      'OIDC: silently refreshed session tokens'
    )
    return tokens.id_token
  } catch (error) {
    request.logger?.warn(
      { err: error.message },
      'OIDC: silent token refresh failed'
    )
    return null
  }
}
