import { describe, expect, test, vi } from 'vitest'

import { authScheme } from './auth-scheme.js'

function buildServer() {
  const strategies = {}
  const schemes = {}
  const extensions = {}
  return {
    auth: {
      scheme: vi.fn((name, fn) => {
        schemes[name] = fn
      }),
      strategy: vi.fn((name, scheme) => {
        strategies[name] = scheme
      })
    },
    ext: vi.fn((event, handler) => {
      extensions[event] = handler
    }),
    _schemes: schemes,
    _strategies: strategies,
    _extensions: extensions
  }
}

function buildRequest(session = undefined) {
  return {
    yar: { get: vi.fn().mockReturnValue(session) },
    logger: { debug: vi.fn() }
  }
}

function buildToolkit() {
  const takeover = vi.fn().mockReturnValue('redirect-takeover-response')
  return {
    authenticated: vi.fn().mockReturnValue('authenticated-response'),
    redirect: vi.fn().mockReturnValue({ takeover }),
    takeover
  }
}

describe('#authScheme', () => {
  describe('plugin registration', () => {
    test('registers a scheme and strategy named "session"', () => {
      const server = buildServer()

      authScheme.plugin.register(server)

      expect(server.auth.scheme).toHaveBeenCalledWith(
        'session',
        expect.any(Function)
      )
      expect(server.auth.strategy).toHaveBeenCalledWith('session', 'session')
    })
  })

  describe('onPreResponse cache control', () => {
    let onPreResponse

    function setup() {
      const server = buildServer()
      authScheme.plugin.register(server)
      onPreResponse = server._extensions.onPreResponse
    }

    test('sets no-store header on authenticated responses', () => {
      setup()
      const header = vi.fn()
      const request = {
        auth: { isAuthenticated: true },
        response: { isBoom: false, header }
      }
      const h = { continue: Symbol('continue') }

      const result = onPreResponse(request, h)

      expect(header).toHaveBeenCalledWith('Cache-Control', 'no-store')
      expect(result).toBe(h.continue)
    })

    test('does not set header on unauthenticated responses', () => {
      setup()
      const header = vi.fn()
      const request = {
        auth: { isAuthenticated: false },
        response: { isBoom: false, header }
      }
      const h = { continue: Symbol('continue') }

      onPreResponse(request, h)

      expect(header).not.toHaveBeenCalled()
    })

    test('does not set header on error responses', () => {
      setup()
      const header = vi.fn()
      const request = {
        auth: { isAuthenticated: true },
        response: { isBoom: true, header }
      }
      const h = { continue: Symbol('continue') }

      onPreResponse(request, h)

      expect(header).not.toHaveBeenCalled()
    })
  })

  describe('authenticate', () => {
    let authenticate

    function setup() {
      const server = buildServer()
      authScheme.plugin.register(server)
      const scheme = server._schemes.session()
      authenticate = scheme.authenticate
    }

    test('returns authenticated with user credentials when session has a user', () => {
      setup()
      const user = { sub: 'user-1', email: 'u@example.com' }
      const request = buildRequest({ user })
      const h = buildToolkit()

      const result = authenticate(request, h)

      expect(h.authenticated).toHaveBeenCalledWith({ credentials: user })
      expect(result).toBe('authenticated-response')
    })

    test('redirects to /auth/forbidden when session has no user', () => {
      setup()
      const request = buildRequest({ token: 'abc' })
      const h = buildToolkit()

      const result = authenticate(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
      expect(h.takeover).toHaveBeenCalled()
      expect(result).toBe('redirect-takeover-response')
    })

    test('redirects to /auth/forbidden when session is null', () => {
      setup()
      const request = buildRequest(null)
      const h = buildToolkit()

      authenticate(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
    })

    test('redirects to /auth/forbidden when yar is missing', () => {
      setup()
      const request = { yar: undefined, logger: { debug: vi.fn() } }
      const h = buildToolkit()

      authenticate(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
    })

    test('logs session state at debug level', () => {
      setup()
      const user = { sub: 'u' }
      const request = buildRequest({ user })
      const h = buildToolkit()

      authenticate(request, h)

      expect(request.logger.debug).toHaveBeenCalledWith(
        { hasYar: true, hasSession: true, hasUser: true },
        expect.any(String)
      )
    })
  })
})
