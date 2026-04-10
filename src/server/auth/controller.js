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
import { statusCodes } from '../common/constants/status-codes.js'

const redirectUri = config.get('oidc.redirectUri')
const postLogoutRedirectUri = config.get('oidc.postLogoutRedirectUri')
const scope = config.get('oidc.scopes')

export const loginController = {
  async handler(request, h) {
    try {
      const oidcConfig = await getOidcConfig()

      const codeVerifier = randomPKCECodeVerifier()
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier)
      const state = randomState()
      const nonce = randomNonce()

      request.yar.set('oidc', { codeVerifier, state, nonce })

      const authorizationUrl = buildAuthorizationUrl(oidcConfig, {
        redirect_uri: redirectUri,
        scope,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce
      })

      return h.redirect(authorizationUrl.href)
    } catch (error) {
      request.logger.error(error, 'OIDC login initiation failed')
      return h.redirect('/auth/forbidden')
    }
  }
}

export const callbackController = {
  async handler(request, h) {
    const pending = request.yar.get('oidc')

    if (!pending?.codeVerifier || !pending?.state || !pending?.nonce) {
      return h.redirect('/auth/login')
    }

    try {
      const oidcConfig = await getOidcConfig()
      const currentUrl = new URL(redirectUri)
      currentUrl.search = request.url.search

      const tokens = await authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: pending.codeVerifier,
        expectedState: pending.state,
        expectedNonce: pending.nonce
      })

      const claims = tokens.claims() ?? {}

      request.yar.set('auth', {
        user: claims,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token
      })
      request.yar.clear('oidc')

      return h.redirect('/projects')
    } catch (error) {
      request.logger.error(error, 'OIDC callback failed')
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
      request.logger.error(error, 'OIDC end-session URL build failed')
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
