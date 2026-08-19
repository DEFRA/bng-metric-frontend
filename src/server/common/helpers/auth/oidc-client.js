import { allowInsecureRequests, customFetch, discovery } from 'openid-client'

import { config } from '../../../../config/config.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

// Placeholder written into a token response that arrived without an
// access_token (see buildTokenResponseFetch). Deliberately an obvious
// non-token: nothing in this app reads the access_token (sessions store only
// the id_token and refresh_token), but if some future code path ever forwards
// it as a credential, verification fails loudly instead of half-working.
export const MISSING_ACCESS_TOKEN_PLACEHOLDER = 'b2c-issued-no-access-token'

/**
 * A fetch wrapper for the OIDC token endpoint that tolerates Azure AD B2C's
 * best-known quirk: B2C includes an access_token in a token response ONLY when
 * the request carried a resource scope (by Defra ID convention, the client ID).
 * When the policy or app registration for an environment stops granting that
 * scope, B2C still returns a perfectly usable id_token + refresh_token — but
 * openid-client (correctly, per spec) rejects the whole response with
 * OAUTH_INVALID_RESPONSE: "access_token" property must be a string. That
 * turned a B2C configuration drift in one environment into a total login
 * outage (BMD-936 follow-up).
 *
 * This app never uses the access_token — the session stores only the id_token
 * (which is also the bearer credential the backend verifies) and the
 * refresh_token. So a token response without one is fully usable here. The
 * wrapper patches exactly that shape — a successful JSON response from the
 * token endpoint carrying an id_token but no access_token — with a placeholder
 * so openid-client's validation passes, and WARNS with the granted scope in
 * the message text (CDP drops structured fields, so the message is all that
 * reaches OpenSearch). Error responses, other endpoints, and responses that
 * already carry an access_token pass through untouched.
 *
 * Attached to the openid-client Configuration via the customFetch symbol, so
 * it covers both the authorization-code exchange and the refresh_token grant,
 * which share the token endpoint.
 *
 * @param {string} tokenEndpoint the token endpoint URL from discovery
 * @param {typeof fetch} [fetchImpl] injectable for tests
 * @returns {typeof fetch}
 */
export function buildTokenResponseFetch(tokenEndpoint, fetchImpl = fetch) {
  return async function tolerantTokenFetch(url, options) {
    const response = await fetchImpl(url, options)

    if (String(url) !== tokenEndpoint || !response.ok) {
      return response
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return response
    }

    // Clone so the untouched path hands openid-client an unread stream.
    const body = await response
      .clone()
      .json()
      .catch(() => null)
    const needsPatch =
      body &&
      typeof body.id_token === 'string' &&
      typeof body.access_token !== 'string'
    if (!needsPatch) {
      return response
    }

    logger.warn(
      `OIDC: token response carried no access_token [grantedScope="${body.scope ?? ''}"] — patched with a placeholder so the exchange can proceed. B2C only returns an access_token when the resource scope (the client ID) is granted; check the app registration / policy for this environment`
    )

    const patched = {
      ...body,
      access_token: MISSING_ACCESS_TOKEN_PLACEHOLDER,
      token_type: body.token_type ?? 'Bearer'
    }
    // Fresh headers: carrying the originals over would keep a content-length
    // that no longer matches the patched body.
    return new Response(JSON.stringify(patched), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'content-type': contentType }
    })
  }
}

let oidcConfigPromise

export function getOidcConfig() {
  if (!oidcConfigPromise) {
    const discoveryUrl = new URL(config.get('oidc.discoveryUrl'))
    const clientId = config.get('oidc.clientId')
    const clientSecret = config.get('oidc.clientSecret')

    const options =
      discoveryUrl.protocol === 'http:'
        ? { execute: [allowInsecureRequests] }
        : undefined

    logger.info(
      {
        discoveryUrl: discoveryUrl.href,
        clientId,
        allowInsecure: Boolean(options)
      },
      'OIDC discovery: fetching provider configuration'
    )

    oidcConfigPromise = discovery(
      discoveryUrl,
      clientId,
      clientSecret,
      undefined,
      options
    )
      .then((oidcConfig) => {
        logger.info(
          { discoveryUrl: discoveryUrl.href },
          'OIDC discovery: provider configuration loaded'
        )
        // Route this configuration's HTTP through the B2C-tolerant fetch so a
        // token response without an access_token (usable here - see
        // buildTokenResponseFetch) degrades to a warning instead of an outage.
        // Guarded: test doubles for discovery() return plain objects without
        // serverMetadata().
        const tokenEndpoint =
          typeof oidcConfig.serverMetadata === 'function'
            ? oidcConfig.serverMetadata().token_endpoint
            : undefined
        if (tokenEndpoint) {
          oidcConfig[customFetch] = buildTokenResponseFetch(tokenEndpoint)
        }
        return oidcConfig
      })
      .catch((error) => {
        oidcConfigPromise = undefined
        logger.error(error, `OIDC discovery failed for ${discoveryUrl.href}`)
        throw error
      })
  }

  return oidcConfigPromise
}

export function resetOidcConfig() {
  oidcConfigPromise = undefined
}
