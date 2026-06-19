describe('#config', () => {
  test('Should default to non-production settings', async () => {
    const { config } = await import('./config.js')

    expect(config.get('log.format')).toBe('pino-pretty')
    expect(config.get('log.redact')).toEqual([])
    expect(config.get('isSecureContextEnabled')).toBe(false)
    expect(config.get('session.cache.engine')).toBe('memory')
  })

  test('Should default to production settings when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    // Production fails fast without a strong forwarding secret; provide one.
    vi.stubEnv('AUTH_FORWARD_SECRET', 'a-strong-production-forward-secret')
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

  test('Should fail fast in production when AUTH_FORWARD_SECRET is the dev default', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()

    await expect(import('./config.js')).rejects.toThrow('AUTH_FORWARD_SECRET')

    vi.unstubAllEnvs()
  })
})
