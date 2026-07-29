import { refreshTokenGrant } from 'openid-client'

import { getOidcConfig } from './oidc-client.js'

/**
 * Pull non-PII diagnostic detail out of an openid-client refresh failure: the
 * OAuth token-endpoint error (`invalid_grant` means the refresh token has
 * expired or been revoked; anything else usually points at config or the IdP
 * being unreachable) plus any HTTP/cause code. Deliberately omits token
 * contents and claims. Used only for logging so CDP logs can explain *why* a
 * silent refresh failed.
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

// A category + short human hint for each way a refresh can fail, logged as
// discrete fields so CDP can filter/aggregate (mirrors the backend's
// classifyVerifyError convention) and a reader sees the likely cause without
// decoding raw OAuth codes. See docs/authentication.md for the full
// "genuinely over" vs "misconfigured" breakdown behind each one.
export const REFRESH_ERROR = {
  noRefreshToken: {
    category: 'no-refresh-token',
    likelyCause:
      'Provider issued no refresh token — check the offline_access scope and Defra ID policy'
  },
  tokenRejected: {
    category: 'refresh-token-rejected',
    likelyCause:
      'Refresh token expired, revoked, rotated, or its lifetime is set shorter than the ID token (genuine when the user was idle; otherwise check Defra ID token-lifetime / rotation)'
  },
  clientAuthFailed: {
    category: 'client-auth-failed',
    likelyCause:
      'Client authentication rejected — check OIDC_CLIENT_SECRET and whether the client is registered confidential vs public'
  },
  scopeRejected: {
    category: 'scope-rejected',
    likelyCause:
      'Scope or resource on the refresh request was rejected — check OIDC_SCOPES against the original grant'
  },
  oauthError: {
    category: 'oauth-error',
    likelyCause:
      'Identity provider returned an OAuth error on the refresh grant'
  },
  idpUnreachable: {
    category: 'idp-unreachable',
    likelyCause:
      'Could not reach the identity provider — check the CDP egress proxy, DNS and TLS'
  },
  unknown: {
    category: 'refresh-failed',
    likelyCause: 'Unclassified refresh failure — see the err and detail fields'
  }
}

// Node/undici error codes that mean the request never reached the IdP.
const NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED'
])

// Standard OAuth 2.0 token-endpoint error codes → our category.
const OAUTH_ERROR_CATEGORY = {
  invalid_grant: REFRESH_ERROR.tokenRejected,
  invalid_client: REFRESH_ERROR.clientAuthFailed,
  unauthorized_client: REFRESH_ERROR.clientAuthFailed,
  invalid_scope: REFRESH_ERROR.scopeRejected
}

/**
 * Best-effort classification of a refresh failure into a { category,
 * likelyCause } from REFRESH_ERROR, for logging only. Prefers the OAuth error
 * code the IdP returned; falls back to network codes; otherwise "unknown".
 *
 * @param {unknown} error
 * @returns {{ category: string, likelyCause: string }}
 */
export function classifyRefreshError(error) {
  const oauthError = typeof error?.error === 'string' ? error.error : null
  if (oauthError) {
    return OAUTH_ERROR_CATEGORY[oauthError] ?? REFRESH_ERROR.oauthError
  }

  const code = error?.code ?? error?.cause?.code
  if (code && NETWORK_ERROR_CODES.has(code)) {
    return REFRESH_ERROR.idpUnreachable
  }

  return REFRESH_ERROR.unknown
}

/**
 * Whether a refreshed claim value carries real information, as opposed to an
 * empty placeholder. Defra ID (Azure AD B2C) runs the relationship/role
 * enrichment only on interactive sign-in, not on a refresh_token grant, so a
 * refreshed id_token can echo `roles`, `relationships` and `currentRelationshipId`
 * back as EMPTY (`[]` / `''`) rather than omitting them. An empty value must not
 * be treated as authoritative.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isMeaningfulClaim(value) {
  if (value === undefined || value === null) {
    return false
  }
  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length > 0
  }
  return true
}

/**
 * Merge the claims from a refreshed id_token over the previous session claims,
 * keeping a previous claim whenever the refreshed token either omits it OR
 * carries it as an empty placeholder. A plain `{ ...prev, ...next }` spread
 * cannot tell those two apart from a genuine value: it preserves an omitted key
 * but lets an empty one overwrite. That overwrite is the BMD-829 session-
 * degradation bug — an idle user's `roles` / `relationships` /
 * `currentRelationshipId` were being blanked on silent refresh, so the home page
 * dropped their organisation and every protected route returned "Access denied"
 * while they still looked signed in. Only meaningfully-present refreshed values
 * win here; everything else falls back to the value captured at login.
 *
 * @param {object} previous the claims stored at login (or the last good refresh)
 * @param {object|null|undefined} refreshed the refreshed id_token's claims
 * @returns {object}
 */
function mergeRefreshedClaims(previous, refreshed) {
  if (!refreshed) {
    return previous
  }
  const merged = { ...previous }
  for (const [key, value] of Object.entries(refreshed)) {
    if (isMeaningfulClaim(value)) {
      merged[key] = value
    }
  }
  return merged
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
    // CDP logs make the difference obvious.
    request.logger?.warn(
      {
        sub: auth?.user?.sub,
        hasSession: Boolean(auth),
        category: REFRESH_ERROR.noRefreshToken.category,
        likelyCause: REFRESH_ERROR.noRefreshToken.likelyCause
      },
      'OIDC: cannot silently refresh — no refresh token stored in session'
    )
    return null
  }

  try {
    const oidcConfig = await getOidcConfig()
    const tokens = await refreshTokenGrant(oidcConfig, refreshToken)
    const claims = tokens.claims()

    request.yar.set('auth', {
      // Merge over the previous claims, keeping any the refreshed token omits OR
      // blanks (roles, relationships, currentRelationshipId, …); losing them
      // here would drop the user's organisation on the home page and flip every
      // role check to /auth/forbidden after a silent refresh. See
      // mergeRefreshedClaims for why an empty value must not overwrite.
      user: mergeRefreshedClaims(auth.user, claims),
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
    const { category, likelyCause } = classifyRefreshError(error)
    request.logger?.warn(
      {
        sub: auth?.user?.sub,
        category,
        likelyCause,
        err: error.message,
        detail: describeRefreshError(error)
      },
      'OIDC: silent token refresh failed'
    )
    return null
  }
}
