import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  randomNonce,
  randomPKCECodeVerifier,
  randomState
} from 'openid-client'

import { config } from '../../config/config.js'
import { getOidcConfig } from '../common/helpers/auth/oidc-client.js'
import {
  recordLoginSuccess,
  recordLoginFailure,
  LOGIN_FAILURE_REASON
} from '../common/helpers/auth/auth-metrics.js'
import { persistBackendSession } from '../common/helpers/auth/persist-session.js'
import { clearSessionEnded } from '../common/helpers/auth/session-expiry.js'
import { statusCodes } from '../common/constants.js'

const redirectUri = config.get('oidc.redirectUri')
const postLogoutRedirectUri = config.get('oidc.postLogoutRedirectUri')
const discoveryUrl = config.get('oidc.discoveryUrl')
const clientId = config.get('oidc.clientId')
const serviceId = config.get('oidc.serviceId')
const useStub = config.get('oidc.useStub')
const scope = useStub
  ? config.get('oidc.scopes')
  : `${config.get('oidc.scopes')} ${clientId}`.trim()

const FORBIDDEN_PATH = '/auth/forbidden'
const SIGNED_OUT_HEADING = 'You have been signed out'

function describeOidcError(error) {
  const cause = error.cause
  const parts = []
  if (error.code) {
    parts.push(`code=${error.code}`)
  }
  if (cause?.code) {
    parts.push(`causeCode=${cause.code}`)
  }
  if (cause?.message) {
    parts.push(`causeMessage=${cause.message}`)
  }
  if (cause?.cause?.body) {
    parts.push(`causeBody=${JSON.stringify(cause.cause.body)}`)
  }
  if (cause?.cause?.claims) {
    parts.push(`causeClaims=${JSON.stringify(cause.cause.claims)}`)
  }
  return parts.join(' | ')
}

function logOidcError(request, error, baseMessage) {
  const detail = describeOidcError(error)
  const message = detail ? `${baseMessage} :: ${detail}` : baseMessage
  request.logger.error(error, message)
}

export const loginController = {
  async handler(request, h) {
    request.logger.info(
      {
        discoveryUrl,
        clientId,
        redirectUri,
        scope,
        serviceId: serviceId || null,
        useStub
      },
      'OIDC login: initiating authorization code flow'
    )

    try {
      const oidcConfig = await getOidcConfig()

      const codeVerifier = randomPKCECodeVerifier()
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier)
      const state = randomState()
      const nonce = randomNonce()

      request.yar.set('oidc', { codeVerifier, state, nonce })

      const parameters = {
        redirect_uri: redirectUri,
        scope,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce
      }

      if (serviceId) {
        parameters.serviceId = serviceId
      }

      if (request.query?.forceReselection === 'true') {
        parameters.forceReselection = 'true'
      }

      const authorizationUrl = buildAuthorizationUrl(oidcConfig, parameters)

      request.logger.info(
        {
          authorizationHost: authorizationUrl.host,
          authorizationPath: authorizationUrl.pathname,
          state
        },
        'OIDC login: redirecting to identity provider authorization endpoint'
      )

      return h.redirect(authorizationUrl.href)
    } catch (error) {
      logOidcError(request, error, 'OIDC login initiation failed')
      await recordLoginFailure(request, LOGIN_FAILURE_REASON.initiation)
      return h.redirect(FORBIDDEN_PATH)
    }
  }
}

async function exchangeCodeForSession(request, h, pending) {
  try {
    const oidcConfig = await getOidcConfig()
    const currentUrl = new URL(redirectUri)
    currentUrl.search = request.url.search

    const checks = {
      pkceCodeVerifier: pending.codeVerifier,
      expectedState: pending.state
    }
    if (!useStub) {
      checks.expectedNonce = pending.nonce
    }
    const tokens = await authorizationCodeGrant(oidcConfig, currentUrl, checks)

    const claims = tokens.claims()

    if (useStub && claims.nonce && claims.nonce !== pending.nonce) {
      throw new Error(
        `Nonce mismatch: expected ${pending.nonce}, got ${claims.nonce}`
      )
    }

    request.logger.info(
      {
        sub: claims?.sub,
        hasNonce: Boolean(claims?.nonce),
        roleCount: Array.isArray(claims?.roles) ? claims.roles.length : 0,
        hasIdToken: Boolean(tokens.id_token),
        hasRefreshToken: Boolean(tokens.refresh_token)
      },
      'OIDC callback: token exchange succeeded'
    )

    request.yar.set('auth', {
      user: claims,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token
    })
    request.yar.clear('oidc')
    // A fresh session supersedes any earlier expiry, so drop the breadcrumb
    // that would otherwise keep routing this browser to /auth/session-expired.
    clearSessionEnded(request)

    // Best-effort: persist the user's identity / relationships / roles in the
    // backend. Never block sign-in on a backend hiccup.
    await persistBackendSession(request, tokens.id_token)

    const stored = request.yar.get('auth')
    request.logger.info(
      { sessionEstablished: Boolean(stored?.user), yarId: request.yar.id },
      'OIDC callback: session established, redirecting to /manage-projects'
    )

    await recordLoginSuccess(request)
    return h.redirect('/manage-projects')
  } catch (error) {
    logOidcError(request, error, 'OIDC callback failed')
    request.yar.clear('oidc')
    await recordLoginFailure(request, LOGIN_FAILURE_REASON.callback)
    return h.redirect(FORBIDDEN_PATH)
  }
}

export const callbackController = {
  async handler(request, h) {
    const params = request.url.searchParams
    const idpError = params.get('error')

    if (idpError) {
      request.logger.warn(
        {
          error: idpError,
          errorDescription: params.get('error_description'),
          state: params.get('state')
        },
        'OIDC callback: identity provider returned an error response'
      )
      request.yar.clear('oidc')
      await recordLoginFailure(request, LOGIN_FAILURE_REASON.callback)
      return h.redirect(FORBIDDEN_PATH)
    }

    const pending = request.yar.get('oidc')

    if (!pending?.codeVerifier || !pending?.state) {
      request.logger.warn(
        {
          hasPendingState: Boolean(pending),
          hasCode: params.has('code'),
          hasState: params.has('state'),
          yarId: request.yar?.id
        },
        'OIDC callback: no pending login state in session, redirecting to /auth/login (the session cookie may not be surviving the round-trip to the identity provider)'
      )
      return h.redirect('/auth/login')
    }

    request.logger.info(
      {
        hasCode: params.has('code'),
        stateMatches: params.get('state') === pending.state
      },
      'OIDC callback: received authorization response, exchanging code for tokens'
    )

    return exchangeCodeForSession(request, h, pending)
  }
}

export const logoutController = {
  async handler(request, h) {
    const session = request.yar.get('auth')
    request.logger.info(
      {
        hadSession: Boolean(session?.user),
        hasIdToken: Boolean(session?.idToken)
      },
      'OIDC logout: clearing session and redirecting to end-session endpoint'
    )
    request.yar.reset()

    try {
      const oidcConfig = await getOidcConfig()
      const endSessionUrl = buildEndSessionUrl(oidcConfig, {
        id_token_hint: session?.idToken,
        post_logout_redirect_uri: postLogoutRedirectUri
      })
      return h.redirect(endSessionUrl.href)
    } catch (error) {
      logOidcError(request, error, 'OIDC end-session URL build failed')
      return h.redirect('/auth/signed-out')
    }
  }
}

export const signedOutController = {
  handler(_request, h) {
    return h.view('auth/signed-out', {
      pageTitle: 'Signed out',
      heading: SIGNED_OUT_HEADING
    })
  }
}

export const sessionExpiredController = {
  handler(_request, h) {
    return h.view('auth/session-expired', {
      pageTitle: SIGNED_OUT_HEADING,
      heading: SIGNED_OUT_HEADING,
      navigation: []
    })
  }
}

export const forbiddenController = {
  handler(_request, h) {
    return h
      .view('auth/forbidden', {
        pageTitle: 'Access denied',
        heading: 'Access denied',
        navigation: []
      })
      .code(statusCodes.forbidden)
  }
}
