import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  callbackController,
  forbiddenController,
  loginController,
  logoutController,
  signedOutController
} from './controller.js'
import { getOidcConfig } from '../common/helpers/auth/oidc-client.js'
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  randomNonce,
  randomPKCECodeVerifier,
  randomState
} from 'openid-client'

vi.mock('openid-client', () => ({
  authorizationCodeGrant: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  buildEndSessionUrl: vi.fn(),
  calculatePKCECodeChallenge: vi.fn(),
  randomNonce: vi.fn(),
  randomPKCECodeVerifier: vi.fn(),
  randomState: vi.fn()
}))

vi.mock('../common/helpers/auth/oidc-client.js', () => ({
  getOidcConfig: vi.fn()
}))

const fakeOidcConfig = { fake: 'config' }

function buildRequest(overrides = {}) {
  const yarStore = new Map()
  const yar = {
    get: vi.fn((key) => yarStore.get(key)),
    set: vi.fn((key, value) => yarStore.set(key, value)),
    clear: vi.fn((key) => yarStore.delete(key)),
    reset: vi.fn(() => yarStore.clear())
  }
  return {
    yar,
    logger: { error: vi.fn() },
    url: new URL('http://localhost:3000/auth/callback?code=abc&state=STATE'),
    ...overrides
  }
}

function buildToolkit() {
  const response = { code: vi.fn().mockReturnThis() }
  return {
    redirect: vi.fn().mockReturnValue('redirect-response'),
    view: vi.fn().mockReturnValue(response),
    _response: response
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getOidcConfig.mockResolvedValue(fakeOidcConfig)
})

describe('#loginController', () => {
  test('stores PKCE state in yar and redirects to the authorization URL', async () => {
    randomPKCECodeVerifier.mockReturnValue('verifier')
    calculatePKCECodeChallenge.mockResolvedValue('challenge')
    randomState.mockReturnValue('state')
    randomNonce.mockReturnValue('nonce')
    buildAuthorizationUrl.mockReturnValue(new URL('https://idp/authorize?x=1'))

    const request = buildRequest()
    const h = buildToolkit()

    const result = await loginController.handler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      fakeOidcConfig,
      expect.objectContaining({
        redirect_uri: expect.any(String),
        scope: expect.any(String),
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
        state: 'state',
        nonce: 'nonce'
      })
    )
    expect(h.redirect).toHaveBeenCalledWith('https://idp/authorize?x=1')
    expect(result).toBe('redirect-response')
  })

  test('redirects to /auth/forbidden when discovery fails', async () => {
    getOidcConfig.mockRejectedValue(new Error('boom'))

    const request = buildRequest()
    const h = buildToolkit()

    await loginController.handler(request, h)

    expect(request.logger.error).toHaveBeenCalled()
    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })
})

describe('#callbackController', () => {
  test('redirects to /auth/login when no pending oidc state is present', async () => {
    const request = buildRequest()
    const h = buildToolkit()

    await callbackController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/login')
    expect(authorizationCodeGrant).not.toHaveBeenCalled()
  })

  test('stores user claims + tokens in yar and redirects to /projects', async () => {
    const request = buildRequest()
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    const claims = { sub: 'user-1', email: 'u@example.com' }
    authorizationCodeGrant.mockResolvedValue({
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      claims: () => claims
    })

    const h = buildToolkit()

    await callbackController.handler(request, h)

    expect(authorizationCodeGrant).toHaveBeenCalledWith(
      fakeOidcConfig,
      expect.any(URL),
      {
        pkceCodeVerifier: 'verifier',
        expectedState: 'state',
        expectedNonce: 'nonce'
      }
    )
    expect(request.yar.set).toHaveBeenCalledWith('auth', {
      user: claims,
      idToken: 'id-token',
      refreshToken: 'refresh-token'
    })
    expect(request.yar.clear).toHaveBeenCalledWith('oidc')
    expect(h.redirect).toHaveBeenCalledWith('/projects')
  })

  test('redirects to /auth/forbidden when token exchange fails', async () => {
    const request = buildRequest()
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    authorizationCodeGrant.mockRejectedValue(new Error('bad state'))

    const h = buildToolkit()

    await callbackController.handler(request, h)

    expect(request.logger.error).toHaveBeenCalled()
    expect(request.yar.clear).toHaveBeenCalledWith('oidc')
    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })
})

describe('#logoutController', () => {
  test('builds the end-session URL with id_token_hint and resets the session', async () => {
    const request = buildRequest()
    request.yar.set('auth', {
      user: { sub: 'u' },
      idToken: 'stored-id-token',
      refreshToken: 'stored-refresh'
    })
    buildEndSessionUrl.mockReturnValue(new URL('https://idp/logout?x=1'))

    const h = buildToolkit()

    await logoutController.handler(request, h)

    expect(request.yar.reset).toHaveBeenCalled()
    expect(buildEndSessionUrl).toHaveBeenCalledWith(
      fakeOidcConfig,
      expect.objectContaining({
        id_token_hint: 'stored-id-token',
        post_logout_redirect_uri: expect.any(String)
      })
    )
    expect(h.redirect).toHaveBeenCalledWith('https://idp/logout?x=1')
  })

  test('falls back to /auth/signed-out if end-session URL build fails', async () => {
    const request = buildRequest()
    getOidcConfig.mockRejectedValue(new Error('discovery broken'))

    const h = buildToolkit()

    await logoutController.handler(request, h)

    expect(request.yar.reset).toHaveBeenCalled()
    expect(h.redirect).toHaveBeenCalledWith('/auth/signed-out')
  })
})

describe('#signedOutController', () => {
  test('renders the signed-out view', () => {
    const h = buildToolkit()
    signedOutController.handler({}, h)
    expect(h.view).toHaveBeenCalledWith(
      'auth/signed-out',
      expect.objectContaining({ pageTitle: 'Signed out' })
    )
  })
})

describe('#forbiddenController', () => {
  test('renders the forbidden view with a 403 status', () => {
    const h = buildToolkit()
    forbiddenController.handler({}, h)
    expect(h.view).toHaveBeenCalledWith(
      'auth/forbidden',
      expect.objectContaining({ pageTitle: 'Access denied' })
    )
    expect(h._response.code).toHaveBeenCalledWith(403)
  })
})
