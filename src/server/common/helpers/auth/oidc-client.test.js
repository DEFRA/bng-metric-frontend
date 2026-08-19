import { beforeEach, describe, expect, test, vi } from 'vitest'

const CUSTOM_FETCH = Symbol('customFetch')

vi.mock('openid-client', () => ({
  allowInsecureRequests: 'ALLOW_INSECURE',
  customFetch: CUSTOM_FETCH,
  discovery: vi.fn()
}))

vi.mock('../../../../config/config.js', () => ({
  config: { get: vi.fn() }
}))

const loggerMock = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
})

vi.mock('../logging/logger.js', () => ({
  createLogger: () => loggerMock()
}))

const { discovery } = await import('openid-client')
const { config } = await import('../../../../config/config.js')

let getOidcConfig, resetOidcConfig

beforeEach(async () => {
  vi.clearAllMocks()

  // Fresh module per test to reset the cached promise
  vi.resetModules()

  vi.doMock('openid-client', () => ({
    allowInsecureRequests: 'ALLOW_INSECURE',
    customFetch: CUSTOM_FETCH,
    discovery
  }))

  vi.doMock('../../../../config/config.js', () => ({
    config: { get: config.get }
  }))

  vi.doMock('../logging/logger.js', () => ({
    createLogger: () => loggerMock()
  }))

  const mod = await import('./oidc-client.js')
  getOidcConfig = mod.getOidcConfig
  resetOidcConfig = mod.resetOidcConfig
})

function stubConfig(overrides = {}) {
  const defaults = {
    'oidc.discoveryUrl':
      'http://localhost:3200/stub/.well-known/openid-configuration',
    'oidc.clientId': 'test-client',
    'oidc.clientSecret': 'test-secret'
  }
  const values = { ...defaults, ...overrides }
  config.get.mockImplementation((key) => values[key])
}

describe('#getOidcConfig', () => {
  test('calls discovery with allowInsecureRequests for HTTP URLs', async () => {
    stubConfig()
    const fakeConfig = { fake: 'config' }
    discovery.mockResolvedValue(fakeConfig)

    const result = await getOidcConfig()

    expect(result).toBe(fakeConfig)
    expect(discovery).toHaveBeenCalledWith(
      new URL('http://localhost:3200/stub/.well-known/openid-configuration'),
      'test-client',
      'test-secret',
      undefined,
      { execute: ['ALLOW_INSECURE'] }
    )
  })

  test('omits allowInsecureRequests for HTTPS URLs', async () => {
    stubConfig({
      'oidc.discoveryUrl':
        'https://login.example.com/.well-known/openid-configuration'
    })
    discovery.mockResolvedValue({ secure: true })

    await getOidcConfig()

    expect(discovery).toHaveBeenCalledWith(
      new URL('https://login.example.com/.well-known/openid-configuration'),
      'test-client',
      'test-secret',
      undefined,
      undefined
    )
  })

  test('attaches the B2C-tolerant fetch to a discovered configuration', async () => {
    stubConfig()
    const oidcConfig = {
      serverMetadata: () => ({ token_endpoint: 'https://b2c.example/token' })
    }
    discovery.mockResolvedValue(oidcConfig)

    const result = await getOidcConfig()

    expect(typeof result[CUSTOM_FETCH]).toBe('function')
  })

  test('leaves a configuration without server metadata untouched (test doubles)', async () => {
    stubConfig()
    discovery.mockResolvedValue({ fake: 'config' })

    const result = await getOidcConfig()

    expect(result[CUSTOM_FETCH]).toBeUndefined()
  })

  test('caches the result across multiple calls', async () => {
    stubConfig()
    discovery.mockResolvedValue({ cached: true })

    const first = await getOidcConfig()
    const second = await getOidcConfig()

    expect(first).toBe(second)
    expect(discovery).toHaveBeenCalledTimes(1)
  })

  test('clears the cache on failure so the next call retries', async () => {
    stubConfig()
    discovery.mockRejectedValueOnce(new Error('network down'))
    discovery.mockResolvedValueOnce({ recovered: true })

    await expect(getOidcConfig()).rejects.toThrow('network down')

    const result = await getOidcConfig()
    expect(result).toEqual({ recovered: true })
    expect(discovery).toHaveBeenCalledTimes(2)
  })
})

describe('#resetOidcConfig', () => {
  test('forces a fresh discovery on the next call', async () => {
    stubConfig()
    discovery.mockResolvedValueOnce({ first: true })
    discovery.mockResolvedValueOnce({ second: true })

    const first = await getOidcConfig()
    expect(first).toEqual({ first: true })

    resetOidcConfig()

    const second = await getOidcConfig()
    expect(second).toEqual({ second: true })
    expect(discovery).toHaveBeenCalledTimes(2)
  })
})

describe('#buildTokenResponseFetch', () => {
  const TOKEN_ENDPOINT = 'https://b2c.example/token'

  // The exact dev-environment failure shape (BMD-936 follow-up): B2C grants
  // only "offline_access openid" (no client-id resource scope), so the token
  // response has an id_token and refresh_token but NO access_token, and
  // openid-client rejects the whole response with OAUTH_INVALID_RESPONSE.
  function b2cResponse(body) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json;charset=UTF-8' }
    })
  }

  async function run(body, { url = TOKEN_ENDPOINT, response } = {}) {
    const { buildTokenResponseFetch } = await import('./oidc-client.js')
    const fetchImpl = vi.fn().mockResolvedValue(response ?? b2cResponse(body))
    const tolerantFetch = buildTokenResponseFetch(TOKEN_ENDPOINT, fetchImpl)
    return { result: await tolerantFetch(url, { method: 'POST' }), fetchImpl }
  }

  test('patches a token response missing its access_token with the placeholder', async () => {
    const { MISSING_ACCESS_TOKEN_PLACEHOLDER } =
      await import('./oidc-client.js')
    const { result } = await run({
      id_token: 'the-id-token',
      refresh_token: 'the-refresh-token',
      token_type: 'Bearer',
      scope: 'offline_access openid'
    })

    const body = await result.json()
    expect(body.access_token).toBe(MISSING_ACCESS_TOKEN_PLACEHOLDER)
    expect(body.id_token).toBe('the-id-token')
    expect(body.refresh_token).toBe('the-refresh-token')
    expect(result.status).toBe(200)
    expect(result.headers.get('content-type')).toContain('application/json')
  })

  test('defaults token_type to Bearer when the patched response omits it', async () => {
    const { result } = await run({ id_token: 'the-id-token' })

    const body = await result.json()
    expect(body.token_type).toBe('Bearer')
  })

  test('passes through a response that already carries an access_token', async () => {
    const original = b2cResponse({
      access_token: 'real-access-token',
      id_token: 'the-id-token'
    })
    const { result } = await run(null, { response: original })

    expect(result).toBe(original)
  })

  test('passes through requests to other endpoints untouched', async () => {
    const original = b2cResponse({ id_token: 'the-id-token' })
    const { result } = await run(null, {
      url: 'https://b2c.example/authorize',
      response: original
    })

    expect(result).toBe(original)
  })

  test('passes through error responses so OAuth errors stay classifiable', async () => {
    // invalid_grant etc. must reach classifyRefreshError verbatim.
    const original = new Response(JSON.stringify({ error: 'invalid_grant' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    })
    const { result } = await run(null, { response: original })

    expect(result).toBe(original)
  })

  test('passes through non-JSON responses untouched', async () => {
    const original = new Response('<html>challenge</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' }
    })
    const { result } = await run(null, { response: original })

    expect(result).toBe(original)
  })

  test('leaves the untouched path with a readable body stream', async () => {
    // The wrapper inspects via clone(); openid-client must still be able to
    // read the original body afterwards.
    const original = b2cResponse({
      access_token: 'real-access-token',
      id_token: 'the-id-token'
    })
    const { result } = await run(null, { response: original })

    await expect(result.json()).resolves.toMatchObject({
      access_token: 'real-access-token'
    })
  })
})
