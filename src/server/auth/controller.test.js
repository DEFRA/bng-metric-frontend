import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  callbackController,
  forbiddenController,
  loginController,
  logoutController,
  sessionExpiredController,
  signedOutController
} from './controller.js'
import { getOidcConfig } from '../common/helpers/auth/oidc-client.js'
import {
  recordLoginSuccess,
  recordLoginFailure,
  LOGIN_FAILURE_REASON
} from '../common/helpers/auth/auth-metrics.js'
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

// Keep the real metric-name/reason constants; stub only the emit functions so
// nothing leaves the process and we can assert intent.
vi.mock('../common/helpers/auth/auth-metrics.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    recordLoginSuccess: vi.fn(),
    recordLoginFailure: vi.fn()
  }
})

// controller.js reads `oidc.useStub` at import time, and that flag is derived
// from OIDC_DISCOVERY_URL. The suites below exercise the live-B2C behaviour
// (clientId appended to the scope, expectedNonce on the grant), so pin a
// non-stub discovery URL before the import runs, and restore it afterwards so
// the value cannot leak into another test file sharing the worker.
const previousDiscoveryUrl = vi.hoisted(() => {
  const previous = process.env.OIDC_DISCOVERY_URL
  process.env.OIDC_DISCOVERY_URL =
    'https://example.b2clogin.com/example.onmicrosoft.com/b2c_1a_signin/v2.0/.well-known/openid-configuration'
  return previous
})

afterAll(() => {
  if (previousDiscoveryUrl === undefined) {
    delete process.env.OIDC_DISCOVERY_URL
  } else {
    process.env.OIDC_DISCOVERY_URL = previousDiscoveryUrl
  }
})

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
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    },
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
    expect(recordLoginFailure).toHaveBeenCalledWith(
      request,
      LOGIN_FAILURE_REASON.initiation
    )
    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })

  test('passes forceReselection when requested', async () => {
    randomPKCECodeVerifier.mockReturnValue('verifier')
    calculatePKCECodeChallenge.mockResolvedValue('challenge')
    randomState.mockReturnValue('state')
    randomNonce.mockReturnValue('nonce')
    buildAuthorizationUrl.mockReturnValue(new URL('https://idp/authorize?x=1'))

    const request = buildRequest({ query: { forceReselection: 'true' } })
    const h = buildToolkit()

    await loginController.handler(request, h)

    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      fakeOidcConfig,
      expect.objectContaining({
        forceReselection: 'true'
      })
    )
  })
})

describe('#callbackController', () => {
  test('redirects to /auth/login and warns when no pending oidc state is present', async () => {
    const request = buildRequest()
    const h = buildToolkit()

    await callbackController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/login')
    expect(authorizationCodeGrant).not.toHaveBeenCalled()
    expect(request.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ hasPendingState: false }),
      expect.stringContaining('no pending login state in session')
    )
    expect(recordLoginFailure).toHaveBeenCalledWith(
      request,
      LOGIN_FAILURE_REASON.noSession
    )
  })

  test('redirects to /auth/forbidden when the identity provider returns an error', async () => {
    const request = buildRequest({
      url: new URL(
        'http://localhost:3000/auth/callback?error=access_denied&error_description=User%20cancelled&state=STATE'
      )
    })
    const h = buildToolkit()

    await callbackController.handler(request, h)

    expect(authorizationCodeGrant).not.toHaveBeenCalled()
    expect(request.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'access_denied',
        errorDescription: 'User cancelled'
      }),
      expect.stringContaining('identity provider returned an error')
    )
    expect(recordLoginFailure).toHaveBeenCalledWith(
      request,
      LOGIN_FAILURE_REASON.idpError
    )
    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })

  test('stores user claims + tokens in yar and redirects to /manage-projects', async () => {
    const request = buildRequest()
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    const claims = {
      sub: 'user-1',
      email: 'u@example.com',
      roles: ['rel-1:bng completer:3']
    }
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
    // The fresh session supersedes any earlier expiry, so the sessionEnded
    // breadcrumb must be cleared too.
    expect(request.yar.clear).toHaveBeenCalledWith('sessionEnded')
    expect(recordLoginSuccess).toHaveBeenCalledWith(request)
    expect(recordLoginFailure).not.toHaveBeenCalled()
    expect(h.redirect).toHaveBeenCalledWith('/manage-projects')
  })

  test('records LoginFailed (RBAC) and still redirects to /manage-projects when the user lacks an approved role', async () => {
    const request = buildRequest()
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    // Authenticated, but the "bng completer" role is pending (status 1), not approved.
    const claims = { sub: 'user-2', roles: ['rel-1:bng completer:1'] }
    authorizationCodeGrant.mockResolvedValue({
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      claims: () => claims
    })

    const h = buildToolkit()

    await callbackController.handler(request, h)

    expect(recordLoginFailure).toHaveBeenCalledWith(
      request,
      LOGIN_FAILURE_REASON.rbac
    )
    expect(recordLoginSuccess).not.toHaveBeenCalled()
    expect(h.redirect).toHaveBeenCalledWith('/manage-projects')
  })

  // BMD-890: projects are scoped to the org the user is signed in as, so a
  // "Change organisation" sign-in must not leave journey state pointing at a
  // project in the org they just left.
  test('clears the previous org’s journey state when the organisation changes', async () => {
    const request = buildRequest()
    request.yar.set('auth', {
      user: { sub: 'user-1', currentRelationshipId: 'rel-org-a' },
      idToken: 'old-id-token',
      refreshToken: 'old-refresh-token'
    })
    request.yar.set('pendingUploadId', 'upload-in-org-a')
    request.yar.set('baselineValidationErrorsProjectId', 'project-in-org-a')
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    authorizationCodeGrant.mockResolvedValue({
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      claims: () => ({ sub: 'user-1', currentRelationshipId: 'rel-org-b' })
    })

    await callbackController.handler(request, buildToolkit())

    expect(request.yar.clear).toHaveBeenCalledWith('pendingUploadId')
    expect(request.yar.clear).toHaveBeenCalledWith(
      'baselineValidationErrorsProjectId'
    )
    expect(request.yar.get('pendingUploadId')).toBeUndefined()
    // The new session is untouched by the clear-out.
    expect(request.yar.get('auth').user.currentRelationshipId).toBe('rel-org-b')
  })

  test('keeps journey state when signing in again as the same organisation', async () => {
    const request = buildRequest()
    request.yar.set('auth', {
      user: { sub: 'user-1', currentRelationshipId: 'rel-org-a' },
      idToken: 'old-id-token',
      refreshToken: 'old-refresh-token'
    })
    request.yar.set('pendingUploadId', 'upload-in-org-a')
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    authorizationCodeGrant.mockResolvedValue({
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      claims: () => ({ sub: 'user-1', currentRelationshipId: 'rel-org-a' })
    })

    await callbackController.handler(request, buildToolkit())

    expect(request.yar.get('pendingUploadId')).toBe('upload-in-org-a')
  })

  test('accepts tokens when nonce is absent from claims (stub compatibility)', async () => {
    const request = buildRequest()
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    const claims = { sub: 'user-1' }
    authorizationCodeGrant.mockResolvedValue({
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      claims: () => claims
    })

    const h = buildToolkit()
    await callbackController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/manage-projects')
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
    expect(recordLoginFailure).toHaveBeenCalledWith(
      request,
      LOGIN_FAILURE_REASON.tokenExchange
    )
    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })

  test('logs the full cause chain when openid-client throws a structured error', async () => {
    const request = buildRequest()
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })

    const innerCause = {
      body: { error: 'invalid_request' },
      claims: { sub: 'user-1', aud: 'client-id' }
    }
    const cause = Object.assign(new Error('JWT "sub" claim missing'), {
      code: 'OAUTH_INVALID_RESPONSE',
      cause: innerCause
    })
    const error = Object.assign(new Error('invalid response encountered'), {
      code: 'OAUTH_INVALID_RESPONSE',
      cause
    })
    authorizationCodeGrant.mockRejectedValue(error)

    const h = buildToolkit()
    await callbackController.handler(request, h)

    expect(request.logger.error).toHaveBeenCalledOnce()
    const [loggedError, loggedMessage] = request.logger.error.mock.calls[0]
    expect(loggedError).toBe(error)
    expect(loggedMessage).toContain('OIDC callback failed ::')
    expect(loggedMessage).toContain('code=OAUTH_INVALID_RESPONSE')
    expect(loggedMessage).toContain('causeCode=OAUTH_INVALID_RESPONSE')
    expect(loggedMessage).toContain('causeMessage=JWT "sub" claim missing')
    expect(loggedMessage).toContain(
      `causeBody=${JSON.stringify(innerCause.body)}`
    )
    expect(loggedMessage).toContain(
      `causeClaims=${JSON.stringify(innerCause.claims)}`
    )
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

describe('#sessionExpiredController', () => {
  test('renders the session-expired view', () => {
    const h = buildToolkit()
    sessionExpiredController.handler({}, h)
    expect(h.view).toHaveBeenCalledWith(
      'auth/session-expired',
      expect.objectContaining({ pageTitle: 'You have been signed out' })
    )
  })

  test('passes an empty navigation array to hide the Projects link', () => {
    const h = buildToolkit()
    sessionExpiredController.handler({}, h)
    expect(h.view).toHaveBeenCalledWith(
      'auth/session-expired',
      expect.objectContaining({ navigation: [] })
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

  test('passes an empty navigation array to hide the Projects link', () => {
    const h = buildToolkit()
    forbiddenController.handler({}, h)
    expect(h.view).toHaveBeenCalledWith(
      'auth/forbidden',
      expect.objectContaining({ navigation: [] })
    )
  })
})

describe('with OIDC_USE_STUB=true', () => {
  let stubLoginController
  let stubCallbackController
  let stubAuthorizationCodeGrant
  let stubBuildAuthorizationUrl
  let stubGetOidcConfig
  let stubRandomPKCECodeVerifier
  let stubCalculatePKCECodeChallenge
  let stubRandomState
  let stubRandomNonce

  beforeAll(async () => {
    vi.stubEnv('OIDC_USE_STUB', 'true')
    vi.resetModules()
    const controllerMod = await import('./controller.js')
    const oidcMod = await import('openid-client')
    const helperMod = await import('../common/helpers/auth/oidc-client.js')
    stubLoginController = controllerMod.loginController
    stubCallbackController = controllerMod.callbackController
    stubAuthorizationCodeGrant = oidcMod.authorizationCodeGrant
    stubBuildAuthorizationUrl = oidcMod.buildAuthorizationUrl
    stubRandomPKCECodeVerifier = oidcMod.randomPKCECodeVerifier
    stubCalculatePKCECodeChallenge = oidcMod.calculatePKCECodeChallenge
    stubRandomState = oidcMod.randomState
    stubRandomNonce = oidcMod.randomNonce
    stubGetOidcConfig = helperMod.getOidcConfig
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    stubGetOidcConfig.mockResolvedValue(fakeOidcConfig)
  })

  test('omits clientId from the requested scope', async () => {
    stubRandomPKCECodeVerifier.mockReturnValue('verifier')
    stubCalculatePKCECodeChallenge.mockResolvedValue('challenge')
    stubRandomState.mockReturnValue('state')
    stubRandomNonce.mockReturnValue('nonce')
    stubBuildAuthorizationUrl.mockReturnValue(new URL('https://stub/authorize'))

    const request = buildRequest()
    const h = buildToolkit()
    await stubLoginController.handler(request, h)

    const [, params] = stubBuildAuthorizationUrl.mock.calls[0]
    expect(params.scope).toBe('openid profile email offline_access')
    expect(params.scope).not.toContain('63983fc2')
  })

  test('omits expectedNonce on the token grant', async () => {
    const request = buildRequest()
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'nonce'
    })
    stubAuthorizationCodeGrant.mockResolvedValue({
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      claims: () => ({ sub: 'u' })
    })

    const h = buildToolkit()
    await stubCallbackController.handler(request, h)

    const [, , checks] = stubAuthorizationCodeGrant.mock.calls[0]
    expect(checks).toEqual({
      pkceCodeVerifier: 'verifier',
      expectedState: 'state'
    })
    expect(checks).not.toHaveProperty('expectedNonce')
    expect(h.redirect).toHaveBeenCalledWith('/manage-projects')
  })

  test('rejects callback when the stub returns a mismatched nonce claim', async () => {
    const request = buildRequest()
    request.yar.set('oidc', {
      codeVerifier: 'verifier',
      state: 'state',
      nonce: 'expected-nonce'
    })
    stubAuthorizationCodeGrant.mockResolvedValue({
      id_token: 'id-token',
      refresh_token: 'refresh-token',
      claims: () => ({ sub: 'u', nonce: 'wrong-nonce' })
    })

    const h = buildToolkit()
    await stubCallbackController.handler(request, h)

    expect(request.logger.error).toHaveBeenCalled()
    const [loggedError] = request.logger.error.mock.calls[0]
    expect(loggedError.message).toBe(
      'Nonce mismatch: expected expected-nonce, got wrong-nonce'
    )
    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })
})

describe('with OIDC_SERVICE_ID configured', () => {
  let serviceIdLoginController
  let serviceIdBuildAuthorizationUrl
  let serviceIdRandomPKCECodeVerifier
  let serviceIdCalculatePKCECodeChallenge
  let serviceIdRandomState
  let serviceIdRandomNonce
  let serviceIdGetOidcConfig

  beforeAll(async () => {
    vi.stubEnv('OIDC_SERVICE_ID', 'svc-abc-123')
    vi.resetModules()
    const controllerMod = await import('./controller.js')
    const oidcMod = await import('openid-client')
    const helperMod = await import('../common/helpers/auth/oidc-client.js')
    serviceIdLoginController = controllerMod.loginController
    serviceIdBuildAuthorizationUrl = oidcMod.buildAuthorizationUrl
    serviceIdRandomPKCECodeVerifier = oidcMod.randomPKCECodeVerifier
    serviceIdCalculatePKCECodeChallenge = oidcMod.calculatePKCECodeChallenge
    serviceIdRandomState = oidcMod.randomState
    serviceIdRandomNonce = oidcMod.randomNonce
    serviceIdGetOidcConfig = helperMod.getOidcConfig
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    serviceIdGetOidcConfig.mockResolvedValue(fakeOidcConfig)
  })

  test('passes serviceId in the authorization request parameters', async () => {
    serviceIdRandomPKCECodeVerifier.mockReturnValue('verifier')
    serviceIdCalculatePKCECodeChallenge.mockResolvedValue('challenge')
    serviceIdRandomState.mockReturnValue('state')
    serviceIdRandomNonce.mockReturnValue('nonce')
    serviceIdBuildAuthorizationUrl.mockReturnValue(
      new URL('https://idp/authorize')
    )

    const request = buildRequest()
    const h = buildToolkit()
    await serviceIdLoginController.handler(request, h)

    const [, params] = serviceIdBuildAuthorizationUrl.mock.calls[0]
    expect(params.serviceId).toBe('svc-abc-123')
  })
})
