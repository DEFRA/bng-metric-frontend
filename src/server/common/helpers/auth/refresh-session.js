import { refreshTokenGrant } from 'openid-client'

import { getOidcConfig } from './oidc-client.js'

/**
 * Pull non-PII diagnostic detail out of an openid-client refresh failure: the
 * OAuth token-endpoint error (`invalid_grant` means the refresh token has
 * expired or been revoked; anything else usually points at config or the IdP
 * being unreachable) plus any HTTP/cause code. Deliberately omits token
 * contents and claims. Used only for logging so CDP logs can explain *why* a
 * silent refresh failed. (BMD-829)
 *
 * @param {unknown} error
 * @returns {string} space-separated `key=value` diagnostics, or '' if none
 */
function describeRefreshError(error) {
  const parts = []
  const add = (label, value) => {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${label}=${value}`)
    }
  }

  const cause = error?.cause
  add('code', error?.code)
  // OAuth 2.0 token-endpoint error fields, surfaced by openid-client v6.
  add('oauthError', error?.error)
  add('oauthErrorDescription', error?.error_description)
  add('causeCode', cause?.code)
  add('causeMessage', cause?.message)
  const body = cause?.cause?.body ?? cause?.body
  if (body) {
    add('body', typeof body === 'string' ? body : JSON.stringify(body))
  }

  return parts.join(' | ')
}

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
    // No refresh token to spend. This is the "silently signed out" case: the
    // provider never issued one (missing `offline_access` scope, or a policy
    // that withholds it), so an expired session can never be renewed and the
    // user is dropped to sign-in. Logged distinctly from a rejected grant so
    // CDP logs make the difference obvious. (BMD-829)
    request.logger?.warn(
      { sub: auth?.user?.sub, hasSession: Boolean(auth) },
      'OIDC: cannot silently refresh — no refresh token stored in session'
    )
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
      {
        sub: auth?.user?.sub,
        err: error.message,
        detail: describeRefreshError(error)
      },
      'OIDC: silent token refresh failed'
    )
    return null
  }
}
