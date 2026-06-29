import { describe, expect, test, vi } from 'vitest'

import {
  getCorrelationId,
  getSessionCorrelationId,
  sessionCorrelation
} from './session-correlation.js'

function buildRequest(user) {
  return {
    yar: { get: vi.fn().mockReturnValue(user ? { user } : undefined) }
  }
}

function buildServer() {
  const extensions = {}
  return {
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

  test('falls back to the sid claim', () => {
    const request = buildRequest({ sid: 'sid-123' })

    expect(getSessionCorrelationId(request)).toBe('sid-123')
  })

  test('falls back to the cid claim', () => {
    const request = buildRequest({ cid: 'cid-123' })

    expect(getSessionCorrelationId(request)).toBe('cid-123')
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
  test('registers an onPreAuth extension', () => {
    const server = buildServer()

    sessionCorrelation.plugin.register(server)

    expect(server.ext).toHaveBeenCalledWith('onPreAuth', expect.any(Function))
  })

  test('stores the session correlation id in request context', () => {
    const server = buildServer()
    const request = buildRequest({ sessionId: 'session-123' })
    const h = { continue: Symbol('continue') }

    sessionCorrelation.plugin.register(server)
    const result = server._extensions.onPreAuth(request, h)

    expect(getCorrelationId()).toBe('session-123')
    expect(result).toBe(h.continue)
  })

  test('clears request context when no correlation id is available', () => {
    const server = buildServer()
    const h = { continue: Symbol('continue') }

    sessionCorrelation.plugin.register(server)
    server._extensions.onPreAuth(buildRequest({ sessionId: 'session-123' }), h)
    server._extensions.onPreAuth(buildRequest({ sub: 'user-123' }), h)

    expect(getCorrelationId()).toBeNull()
  })
})

