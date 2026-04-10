import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('openid-client', () => ({
  allowInsecureRequests: 'ALLOW_INSECURE',
  discovery: vi.fn()
}))

vi.mock('../../../../config/config.js', () => ({
  config: { get: vi.fn() }
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
    discovery
  }))

  vi.doMock('../../../../config/config.js', () => ({
    config: { get: config.get }
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
