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
  noIdToken: {
    category: 'no-id-token',
    likelyCause:
      'Refresh grant succeeded but returned no id_token — check the Defra ID policy issues one on the refresh_token flow, and that OIDC_SCOPES still carries openid'
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

// The relationship/role enrichment claims. Defra ID (Azure AD B2C) runs its
// enrichment ONLY on an interactive sign-in, so whatever a refresh_token grant
// returns in these three is never authoritative — it is at best a stale echo of
// the sign-in values and at worst a default. They are therefore PINNED to the
// values captured at sign-in and a refreshed token can never overwrite them.
// See mergeRefreshedClaims for why "non-empty" is not a good enough test.
const ENRICHMENT_CLAIMS = Object.freeze([
  'roles',
  'relationships',
  'currentRelationshipId'
])

/**
 * Merge the claims from a refreshed id_token over the previous session claims.
 *
 * Two rules, in order:
 *
 * 1. The enrichment claims (ENRICHMENT_CLAIMS) are never taken from a refreshed
 *    token — they always keep their sign-in values.
 * 2. Every other claim is taken from the refreshed token when it is meaningfully
 *    present, and kept from the previous claims when the refreshed token omits it
 *    or returns it blank.
 *
 * Rule 2 alone was the BMD-829 fix: a plain `{ ...prev, ...next }` spread cannot
 * tell an omitted claim from a blanked one, so an idle user's enrichment claims
 * were being wiped on silent refresh — organisation gone from the home page,
 * "Access denied" on every protected route, while still looking signed in.
 *
 * Rule 1 (BMD-936) closes the other half of the same hole. Guarding on
 * "meaningfully present" only stops an EMPTY value overwriting a good one; it
 * still lets a non-empty but non-authoritative one through. In the deployed
 * environment Defra ID returns enrichment claims on refresh that are non-empty
 * yet different from the sign-in values — a `roles` collection flattened to a
 * scalar, statuses that are no longer 3, or a `currentRelationshipId` naming a
 * different org from the one the user signed in under. Any of those merges into
 * a claim set that is individually plausible but internally inconsistent, which
 * `hasBngCompleterRole` (an invariant ACROSS roles + currentRelationshipId, not
 * a per-claim test) then fails — ejecting a user whose renewal had in fact just
 * succeeded. Pinning removes the whole class: the post-refresh authorisation
 * decision is identical to the sign-in one by construction.
 *
 * This mirrors the backend, which authorises from the roles it persisted at
 * sign-in rather than from token claims (bng-metric-backend
 * src/db/project-visibility.js). Revocation is picked up at the next interactive
 * sign-in on both sides.
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
    if (!ENRICHMENT_CLAIMS.includes(key) && isMeaningfulClaim(value)) {
      merged[key] = value
    }
  }
  return merged
}

/**
 * Describe the SHAPE of each enrichment claim in a refreshed id_token, and
 * whether it differs from the pinned sign-in value — never the value itself
 * (role strings and relationship strings carry org names and ids: PII).
 *
 * This goes into the log MESSAGE rather than a structured field because CDP's
 * log ingestion drops non-allowlisted fields, so the message text is all that
 * survives to OpenSearch — the same reason session.id is prefixed onto messages
 * in logging/logger-options.js.
 *
 * Reads as e.g. `roles=array:1(differs) relationships=blank
 * currentRelationshipId=scalar(differs)`, which names the mechanism directly:
 * `scalar` where an array is expected is a collection claim B2C has flattened,
 * and `(differs)` on any of the three is a value that would have overwritten a
 * good sign-in claim before BMD-936 pinned them.
 *
 * @param {object} previous the claims stored at login
 * @param {object|null|undefined} refreshed the refreshed id_token's claims
 * @returns {string}
 */
function describeEnrichmentDrift(previous, refreshed) {
  return ENRICHMENT_CLAIMS.map((claim) => {
    const value = refreshed?.[claim]
    // Explicit comparator (S2871): the claims are strings, but a bare sort()
    // coerces implicitly. Ordering only needs to be consistent between the
    // two sides of the comparison, not meaningful.
    const normalise = (v) =>
      Array.isArray(v)
        ? [...v].sort((a, b) => String(a).localeCompare(String(b)))
        : v
    const differs =
      JSON.stringify(normalise(value)) !==
      JSON.stringify(normalise(previous?.[claim]))
    return `${claim}=${describeClaimShape(value)}${differs ? '(differs)' : ''}`
  }).join(' ')
}

function describeClaimShape(value) {
  if (value === undefined || value === null) {
    return 'absent'
  }
  if (Array.isArray(value)) {
    return `array:${value.length}`
  }
  if (typeof value === 'string') {
    return value.length > 0 ? 'scalar' : 'string:0'
  }
  return typeof value
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

    // The grant succeeded but carries no id_token. The id_token IS the session
    // here — it holds the `exp` the expiry check reads and it is the bearer
    // credential forwarded to the backend — so there is nothing to renew with.
    // Bail out BEFORE touching the session: writing `idToken: undefined` and
    // then returning a falsy value left the caller to expire a session we had
    // already corrupted, and logged a success line one millisecond before the
    // failure. Returning null here ends the session cleanly and sends the user
    // to /auth/session-expired ("Sign in again"), which is the right outcome —
    // we cannot renew without a token, and re-authenticating gets them one.
    if (!tokens.id_token) {
      request.logger?.warn(
        {
          sub: auth?.user?.sub,
          category: REFRESH_ERROR.noIdToken.category,
          likelyCause: REFRESH_ERROR.noIdToken.likelyCause
        },
        `OIDC: silent token refresh failed [category=${REFRESH_ERROR.noIdToken.category}]`
      )
      return null
    }

    const claims = tokens.claims()

    request.yar.set('auth', {
      // Merge over the previous claims: the enrichment claims (roles,
      // relationships, currentRelationshipId) stay pinned to their sign-in
      // values, and every other claim is kept when the refreshed token omits or
      // blanks it. Letting a refreshed token win on the enrichment claims drops
      // the user's organisation on the home page and flips every role check to
      // /auth/forbidden. See mergeRefreshedClaims.
      user: mergeRefreshedClaims(auth.user, claims),
      idToken: tokens.id_token,
      // Some providers omit a new refresh token on refresh — keep the old one.
      refreshToken: tokens.refresh_token ?? refreshToken
    })

    // The enrichment shapes ride in the message text, not a structured field:
    // CDP drops unmapped fields, so this is the only form that reaches
    // OpenSearch. It is what tells us which shape Defra ID actually returns on a
    // refresh grant, now that we no longer act on it.
    request.logger?.info(
      { sub: claims?.sub },
      `OIDC: silently refreshed session tokens [${describeEnrichmentDrift(auth.user, claims)}]`
    )
    return tokens.id_token
  } catch (error) {
    const { category, likelyCause } = classifyRefreshError(error)
    // The category rides in the message as well as the field: CDP drops
    // unmapped structured fields, so without it every one of these failures
    // reads identically in OpenSearch and the cause table below is unusable.
    request.logger?.warn(
      {
        sub: auth?.user?.sub,
        category,
        likelyCause,
        err: error.message,
        detail: describeRefreshError(error)
      },
      `OIDC: silent token refresh failed [category=${category}]`
    )
    return null
  }
}
