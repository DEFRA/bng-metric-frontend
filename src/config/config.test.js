describe('#config', () => {
  test('Should default to non-production settings', async () => {
    const { config } = await import('./config.js')

    expect(config.get('log.format')).toBe('pino-pretty')
    expect(config.get('log.redact')).toEqual([])
    expect(config.get('isSecureContextEnabled')).toBe(false)
    expect(config.get('session.cache.engine')).toBe('memory')
    // Session lifetime is a single seconds-based knob (default 4 hours).
    expect(config.get('session.ttlSeconds')).toBe(4 * 60 * 60)
  })

  test('Should default to production settings when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()

    const { config } = await import('./config.js')

    expect(config.get('log.format')).toBe('ecs')
    expect(config.get('log.redact')).toEqual([
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers'
    ])
    expect(config.get('isSecureContextEnabled')).toBe(true)
    expect(config.get('session.cache.engine')).toBe('redis')

    vi.unstubAllEnvs()
  })

  // The stub and live B2C differ in scope and nonce handling, so `oidc.useStub`
  // has to match whichever provider `OIDC_DISCOVERY_URL` names. Deriving the
  // default from the URL is what stops the two drifting apart in a deployed
  // environment (a stub URL with OIDC_USE_STUB=false breaks login).
  test('Should derive oidc.useStub from a stub discovery URL', async () => {
    vi.stubEnv(
      'OIDC_DISCOVERY_URL',
      'https://cdp-defra-id-stub.dev.cdp-int.defra.cloud/cdp-defra-id-stub/.well-known/openid-configuration'
    )
    vi.resetModules()

    const { config } = await import('./config.js')

    expect(config.get('oidc.useStub')).toBe(true)

    vi.unstubAllEnvs()
  })

  test('Should derive oidc.useStub as false for a live B2C discovery URL', async () => {
    vi.stubEnv(
      'OIDC_DISCOVERY_URL',
      'https://example.b2clogin.com/example.onmicrosoft.com/b2c_1a_signin/v2.0/.well-known/openid-configuration'
    )
    vi.resetModules()

    const { config } = await import('./config.js')

    expect(config.get('oidc.useStub')).toBe(false)

    vi.unstubAllEnvs()
  })

  test('Should let an explicit OIDC_USE_STUB override the derived value', async () => {
    vi.stubEnv(
      'OIDC_DISCOVERY_URL',
      'https://cdp-defra-id-stub.dev.cdp-int.defra.cloud/cdp-defra-id-stub/.well-known/openid-configuration'
    )
    vi.stubEnv('OIDC_USE_STUB', 'false')
    vi.resetModules()

    const { config } = await import('./config.js')

    expect(config.get('oidc.useStub')).toBe(false)

    vi.unstubAllEnvs()
  })
})
