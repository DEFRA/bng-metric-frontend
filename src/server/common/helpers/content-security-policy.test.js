import { createServer } from '../../server.js'
import { createHash } from 'node:crypto'
import { renderTemplate } from '../../test-helpers/render-template.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('sets the expected CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const policy = resp.headers['content-security-policy']
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).not.toContain('unsafe-inline')
  })
})

describe('GTM content security policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('serves GTM with matching CSP on two successive page requests', async () => {
    vi.stubEnv('ENVIRONMENT', 'dev')
    vi.stubEnv('GTM_ENABLED', 'true')
    vi.resetModules()
    const { createServer: createNonProdServer } =
      await import('../../server.js')
    const server = await createNonProdServer()
    await server.initialize()
    try {
      for (const url of ['/', '/about']) {
        const response = await server.inject({ method: 'GET', url })
        expect(response.statusCode).toBe(200)
        const [consentScript, script] = [
          ...response.payload.matchAll(/<script>([\s\S]*?)<\/script>/g)
        ].map((match) => match[1])
        const policy = response.headers['content-security-policy']
        expect(consentScript).toContain("analytics_storage:'granted'")
        for (const source of [consentScript, script]) {
          const hash = createHash('sha256').update(source).digest('base64')
          expect(policy).toContain(`'sha256-${hash}'`)
        }
        expect(script).toContain('GTM-K5LRK3HR')
        expect(policy).toContain('https://www.googletagmanager.com')
        expect(policy).toContain('https://*.google-analytics.com')
        expect(policy).not.toContain('unsafe-inline')
        expect(
          response.payload.match(/ns.html\?id=GTM-K5LRK3HR/g)
        ).toHaveLength(1)
      }
    } finally {
      await server.stop({ timeout: 0 })
    }
  })

  test.each(['dev', 'prod', 'unknown', ''])(
    'keeps the CSP and rendered snippets consistent for %j',
    async (environment) => {
      vi.stubEnv('ENVIRONMENT', environment)
      vi.stubEnv('GTM_ENABLED', 'true')
      vi.resetModules()
      const { contentSecurityPolicy } =
        await import('./content-security-policy.js')
      const {
        googleAnalyticsConsentScript,
        googleTagManagerScript,
        isGoogleTagManagerEnabled
      } = await import('./google-tag-manager.js')
      const enabled = isGoogleTagManagerEnabled()
      const html = renderTemplate('home/index.njk', {
        googleTagManager: {
          enabled,
          consentScript: googleAnalyticsConsentScript,
          script: googleTagManagerScript
        }
      })
      const options = contentSecurityPolicy.options
      expect(options.scriptSrc).not.toContain('unsafe-inline')
      expect(options.scriptSrc).not.toContain('unsafe-eval')
      if (environment === 'dev') {
        const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
          .slice(0, 2)
          .map((match) => match[1])
        for (const script of scripts) {
          const hash = createHash('sha256').update(script).digest('base64')
          expect(options.scriptSrc).toContain(`'sha256-${hash}'`)
        }
        expect(options.scriptSrc).toContain('https://www.googletagmanager.com')
        expect(options.connectSrc).toContain('https://*.google-analytics.com')
        expect(options.frameSrc).toContain('https://www.googletagmanager.com')
        const style = html.match(/<iframe[^>]*style="([^"]+)"/)[1]
        const styleHash = createHash('sha256').update(style).digest('base64')
        expect(options.styleSrc).toContain(`'sha256-${styleHash}'`)
        expect(options.styleSrc).toContain("'unsafe-hashes'")
      } else {
        expect(html).not.toContain('googletagmanager.com')
        expect(html).not.toContain('analytics_storage')
        expect(JSON.stringify(options)).not.toContain('google')
      }
    }
  )
})
