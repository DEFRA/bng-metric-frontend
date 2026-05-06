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
import { statusCodes } from '../common/constants.js'

const redirectUri = config.get('oidc.redirectUri')
const postLogoutRedirectUri = config.get('oidc.postLogoutRedirectUri')
const clientId = config.get('oidc.clientId')
const serviceId = config.get('oidc.serviceId')
const useStub = config.get('oidc.useStub')
const scope = useStub
  ? config.get('oidc.scopes')
  : `${config.get('oidc.scopes')} ${clientId}`.trim()

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

      const authorizationUrl = buildAuthorizationUrl(oidcConfig, parameters)

      return h.redirect(authorizationUrl.href)
    } catch (error) {
      logOidcError(request, error, 'OIDC login initiation failed')
      return h.redirect('/auth/forbidden')
    }
  }
}

export const callbackController = {
  async handler(request, h) {
    const pending = request.yar.get('oidc')

    if (!pending?.codeVerifier || !pending?.state) {
      return h.redirect('/auth/login')
    }

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
      const tokens = await authorizationCodeGrant(
        oidcConfig,
        currentUrl,
        checks
      )

      const claims = tokens.claims()

      if (useStub && claims.nonce && claims.nonce !== pending.nonce) {
        throw new Error(
          `Nonce mismatch: expected ${pending.nonce}, got ${claims.nonce}`
        )
      }

      request.logger.debug(
        {
          sub: claims?.sub,
          hasNonce: Boolean(claims?.nonce),
          roles: claims?.roles
        },
        'OIDC callback: token exchange succeeded'
      )

      request.yar.set('auth', {
        user: claims,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token
      })
      request.yar.clear('oidc')

      const stored = request.yar.get('auth')
      request.logger.debug(
        { storedUser: Boolean(stored?.user), yarId: request.yar.id },
        'OIDC callback: session stored, redirecting to /project-dashboard'
      )

      return h.redirect('/project-dashboard')
    } catch (error) {
      logOidcError(request, error, 'OIDC callback failed')
      request.yar.clear('oidc')
      return h.redirect('/auth/forbidden')
    }
  }
}

export const logoutController = {
  async handler(request, h) {
    const session = request.yar.get('auth')
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
      heading: 'You have been signed out'
    })
  }
}

export const forbiddenController = {
  handler(_request, h) {
    return h
      .view('auth/forbidden', {
        pageTitle: 'Access denied',
        heading: 'Access denied'
      })
      .code(statusCodes.forbidden)
  }
}
