import { describe, expect, test, vi } from 'vitest'

import {
  getCorrelationId,
  getSessionCorrelationId,
  sessionCorrelation
} from './session-correlation.js'

function buildRequest(user) {
  return {
    _lifecycle: vi.fn(),
    _postCycle: vi.fn(),
    plugins: {},
    yar: { get: vi.fn().mockReturnValue(user ? { user } : undefined) },
    logger: 'request-logger'
  }
}

function buildServer() {
  const extensions = {}
  return {
    logger: {
      child: vi.fn().mockReturnValue('session-logger')
    },
    ext: vi.fn((event, handler) => {
      extensions[event] = handler
    }),
    _extensions: extensions
  }
}

describe('#getSessionCorrelationId', () => {
  test('returns the Defra sessionId claim when available', () => {
    const request = buildRequest({ sessionId: 'session-123', sid: 'sid-123' })

    expect(getSessionCorrelationId(request)).toBe('session-123')
  })

  test('falls back to the correlationId claim', () => {
    const request = buildRequest({ correlationId: 'correlation-123' })

    expect(getSessionCorrelationId(request)).toBe('correlation-123')
  })

  test('falls back to the sid claim', () => {
    const request = buildRequest({ sid: 'sid-123' })

    expect(getSessionCorrelationId(request)).toBe('sid-123')
  })

  test('does not use cid as a session correlation id', () => {
    const request = buildRequest({ cid: 'cid-123' })

    expect(getSessionCorrelationId(request)).toBeNull()
  })

  test('ignores empty session identifiers', () => {
    const request = buildRequest({ sessionId: ' ', sid: '' })

    expect(getSessionCorrelationId(request)).toBeNull()
  })

  test('returns null when there is no supported claim', () => {
    const request = buildRequest({ sub: 'user-123' })

    expect(getSessionCorrelationId(request)).toBeNull()
  })
})

describe('#sessionCorrelation', () => {
  test('registers onRequest and onPreAuth extensions', () => {
    const server = buildServer()

    sessionCorrelation.plugin.register(server)

    expect(server.ext).toHaveBeenCalledWith('onRequest', expect.any(Function))
    expect(server.ext).toHaveBeenCalledWith('onPreAuth', expect.any(Function))
  })

  test('stores the session correlation id on request plugins', () => {
    const server = buildServer()
    const request = buildRequest({ sessionId: 'session-123' })
    const h = { continue: Symbol('continue') }

    sessionCorrelation.plugin.register(server)
    const result = server._extensions.onPreAuth(request, h)

    expect(request.plugins['session-correlation']).toEqual({
      correlationId: 'session-123'
    })
    expect(result).toBe(h.continue)
  })

  test('binds the session correlation id to the request logger', () => {
    const server = buildServer()
    const request = buildRequest({ sessionId: 'session-123' })
    const h = { continue: Symbol('continue') }

    sessionCorrelation.plugin.register(server)
    server._extensions.onPreAuth(request, h)

    expect(server.logger.child).toHaveBeenCalledWith({
      req: request,
      trace: { id: 'session-123' }
    })
    expect(request.logger).toBe('session-logger')
  })

  test('exposes the session correlation id throughout the wrapped lifecycle', () => {
    const server = buildServer()
    const h = { continue: Symbol('continue') }
    const request = buildRequest({ sessionId: 'session-123' })

    sessionCorrelation.plugin.register(server)
    request._lifecycle = vi.fn(() => {
      server._extensions.onPreAuth(request, h)
      return getCorrelationId()
    })

    server._extensions.onRequest(request, h)

    expect(request._lifecycle()).toBe('session-123')
    expect(getCorrelationId()).toBeNull()
  })

  test('leaves the logger unchanged when no correlation id is available', () => {
    const server = buildServer()
    const request = buildRequest({ sub: 'user-123' })
    const h = { continue: Symbol('continue') }

    sessionCorrelation.plugin.register(server)
    server._extensions.onPreAuth(request, h)

    expect(request.plugins['session-correlation']).toEqual({
      correlationId: null
    })
    expect(server.logger.child).not.toHaveBeenCalled()
    expect(request.logger).toBe('request-logger')
  })
})
