import { describe, expect, test, vi } from 'vitest'

import { authScheme } from './auth-scheme.js'
import { refreshSession } from './refresh-session.js'

vi.mock('./refresh-session.js', () => ({
  refreshSession: vi.fn()
}))

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600
const PAST_EXP = Math.floor(Date.now() / 1000) - 3600

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

function buildRequest(session = undefined, { mode = 'required' } = {}) {
  const store = { auth: session }
  return {
    yar: {
      get: vi.fn((key) => store[key]),
      set: vi.fn((key, value) => {
        store[key] = value
      }),
      reset: vi.fn(() => {
        store.auth = undefined
      })
    },
    route: { settings: { auth: { mode } } },
    logger: { debug: vi.fn(), info: vi.fn() },
    _store: store
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

afterEach(() => {
  vi.clearAllMocks()
})

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

    test('returns authenticated with user credentials when the session token is fresh', async () => {
      setup()
      const user = { sub: 'user-1', email: 'u@example.com', exp: FUTURE_EXP }
      const request = buildRequest({ user })
      const h = buildToolkit()

      const result = await authenticate(request, h)

      expect(h.authenticated).toHaveBeenCalledWith({ credentials: user })
      expect(result).toBe('authenticated-response')
      expect(refreshSession).not.toHaveBeenCalled()
    })

    test('redirects to /auth/forbidden when session has no user', async () => {
      setup()
      const request = buildRequest({ token: 'abc' })
      const h = buildToolkit()

      const result = await authenticate(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
      expect(h.takeover).toHaveBeenCalled()
      expect(result).toBe('redirect-takeover-response')
    })

    test('redirects to /auth/forbidden when session is null', async () => {
      setup()
      const request = buildRequest(null)
      const h = buildToolkit()

      await authenticate(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
    })

    test('redirects to /auth/forbidden when yar is missing', async () => {
      setup()
      const request = {
        yar: undefined,
        route: { settings: { auth: { mode: 'required' } } },
        logger: { debug: vi.fn(), info: vi.fn() }
      }
      const h = buildToolkit()

      await authenticate(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
    })

    test('redirects an emptied-but-recently-ended session to /auth/session-expired', async () => {
      // A 'try'-mode page (e.g. the home page) already ended an expired session
      // and left the sessionEnded breadcrumb; the next protected click has no
      // user but must still be treated as an expired session, not a stranger.
      setup()
      const request = buildRequest(undefined)
      request._store.sessionEnded = true
      const h = buildToolkit()

      const result = await authenticate(request, h)

      expect(h.redirect).toHaveBeenCalledWith('/auth/session-expired')
      expect(result).toBe('redirect-takeover-response')
    })

    test('silently refreshes an expired session and authenticates with the refreshed claims', async () => {
      setup()
      const staleUser = { sub: 'user-1', exp: PAST_EXP }
      const request = buildRequest({ user: staleUser })
      const freshUser = { sub: 'user-1', exp: FUTURE_EXP }
      vi.mocked(refreshSession).mockImplementation(async (req) => {
        req._store.auth = { user: freshUser, idToken: 'new-id' }
        return 'new-id'
      })
      const h = buildToolkit()

      const result = await authenticate(request, h)

      expect(refreshSession).toHaveBeenCalledTimes(1)
      expect(h.authenticated).toHaveBeenCalledWith({ credentials: freshUser })
      expect(result).toBe('authenticated-response')
    })

    test('treats a session without an exp claim as expired and refreshes it', async () => {
      setup()
      const request = buildRequest({ user: { sub: 'user-1' } })
      vi.mocked(refreshSession).mockResolvedValue('new-id')
      const h = buildToolkit()

      await authenticate(request, h)

      expect(refreshSession).toHaveBeenCalledTimes(1)
    })

    test('ends the session and redirects to /auth/session-expired when the refresh fails', async () => {
      setup()
      const request = buildRequest({ user: { sub: 'user-1', exp: PAST_EXP } })
      vi.mocked(refreshSession).mockResolvedValue(null)
      const h = buildToolkit()

      const result = await authenticate(request, h)

      expect(request.yar.reset).toHaveBeenCalledTimes(1)
      expect(h.redirect).toHaveBeenCalledWith('/auth/session-expired')
      expect(result).toBe('redirect-takeover-response')
    })

    test('throws instead of redirecting on a try-mode route with no session', async () => {
      setup()
      const request = buildRequest(undefined, { mode: 'try' })
      const h = buildToolkit()

      await expect(authenticate(request, h)).rejects.toMatchObject({
        isBoom: true,
        output: { statusCode: 401 }
      })
      expect(h.redirect).not.toHaveBeenCalled()
    })

    test('throws and clears the session on a try-mode route when the refresh fails', async () => {
      setup()
      const request = buildRequest(
        { user: { sub: 'user-1', exp: PAST_EXP } },
        { mode: 'try' }
      )
      vi.mocked(refreshSession).mockResolvedValue(null)
      const h = buildToolkit()

      await expect(authenticate(request, h)).rejects.toMatchObject({
        isBoom: true,
        output: { statusCode: 401 }
      })
      expect(request.yar.reset).toHaveBeenCalledTimes(1)
      expect(h.redirect).not.toHaveBeenCalled()
    })

    test('renews the sliding session (touch) on a fresh authenticated request', async () => {
      setup()
      const user = { sub: 'user-1', exp: FUTURE_EXP }
      const request = buildRequest({ user })
      const h = buildToolkit()

      await authenticate(request, h)

      // touchSession re-sets the auth entry so yar resets the cache/cookie TTL.
      expect(request.yar.set).toHaveBeenCalledWith('auth', { user })
      expect(h.authenticated).toHaveBeenCalledWith({ credentials: user })
    })

    test('authenticates seamlessly when the refreshed session keeps the approved role', async () => {
      setup()
      const approvedUser = {
        sub: 'user-1',
        exp: PAST_EXP,
        roles: ['rel-1:bng completer:3']
      }
      const request = buildRequest({ user: approvedUser })
      const refreshedUser = {
        sub: 'user-1',
        exp: FUTURE_EXP,
        roles: ['rel-1:bng completer:3']
      }
      vi.mocked(refreshSession).mockImplementation(async (req) => {
        req._store.auth = { user: refreshedUser, idToken: 'new-id' }
        return 'new-id'
      })
      const h = buildToolkit()

      await authenticate(request, h)

      expect(h.authenticated).toHaveBeenCalledWith({
        credentials: refreshedUser
      })
      expect(request.yar.reset).not.toHaveBeenCalled()
    })

    test('ends the session when a silent refresh downgrades a previously-approved role', async () => {
      // The realistic trigger is a MEANINGFUL downgrade (approved status 3 ->
      // pending status 1) that the guarded merge would actually apply — not an
      // empty roles array, which mergeRefreshedClaims preserves (so it would
      // never reach the guard as a downgrade in the real flow).
      setup()
      const approvedUser = {
        sub: 'user-1',
        exp: PAST_EXP,
        roles: ['rel-1:bng completer:3']
      }
      const request = buildRequest({ user: approvedUser })
      const downgradedUser = {
        sub: 'user-1',
        exp: FUTURE_EXP,
        roles: ['rel-1:bng completer:1']
      }
      vi.mocked(refreshSession).mockImplementation(async (req) => {
        req._store.auth = { user: downgradedUser, idToken: 'new-id' }
        return 'new-id'
      })
      const h = buildToolkit()

      const result = await authenticate(request, h)

      expect(request.yar.reset).toHaveBeenCalledTimes(1)
      expect(h.redirect).toHaveBeenCalledWith('/auth/session-expired')
      expect(h.authenticated).not.toHaveBeenCalled()
      expect(result).toBe('redirect-takeover-response')
    })

    test('does not end the session for a still-pending user after refresh', async () => {
      // A user who never held an approved role is a valid pending state, not a
      // refresh regression — they must reach the pages (and get "Access denied"
      // per-route), never be forced back to sign-in on every silent refresh.
      setup()
      const pendingUser = {
        sub: 'user-1',
        exp: PAST_EXP,
        roles: ['rel-1:bng completer:1']
      }
      const request = buildRequest({ user: pendingUser })
      const refreshedPending = {
        sub: 'user-1',
        exp: FUTURE_EXP,
        roles: ['rel-1:bng completer:1']
      }
      vi.mocked(refreshSession).mockImplementation(async (req) => {
        req._store.auth = { user: refreshedPending, idToken: 'new-id' }
        return 'new-id'
      })
      const h = buildToolkit()

      await authenticate(request, h)

      expect(request.yar.reset).not.toHaveBeenCalled()
      expect(h.authenticated).toHaveBeenCalledWith({
        credentials: refreshedPending
      })
    })

    test('logs session state at debug level', async () => {
      setup()
      const user = { sub: 'u', exp: FUTURE_EXP }
      const request = buildRequest({ user })
      const h = buildToolkit()

      await authenticate(request, h)

      expect(request.logger.debug).toHaveBeenCalledWith(
        { hasYar: true, hasSession: true, hasUser: true },
        expect.any(String)
      )
    })
  })
})
