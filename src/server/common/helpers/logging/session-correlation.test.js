import Hapi from '@hapi/hapi'
import hapiPino from 'hapi-pino'
import pino from 'pino'
import { PassThrough } from 'node:stream'
import { describe, expect, test, vi } from 'vitest'

import { loggerOptions } from './logger-options.js'
import {
  getCorrelationId,
  getSessionCorrelationId,
  sessionCorrelation
} from './session-correlation.js'

function buildRequest(user, authCredentials = undefined) {
  return {
    _lifecycle: vi.fn(),
    _postCycle: vi.fn(),
    auth: { credentials: authCredentials },
    plugins: {},
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

function captureLogStream() {
  const stream = new PassThrough()
  const logs = []
  let buffer = ''

  stream.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.trim()) {
        logs.push(JSON.parse(line))
      }
    }
  })

  return { stream, logs }
}

function logMessage(log) {
  return log.message ?? log.msg
}

describe('#getSessionCorrelationId', () => {
  test('returns the Defra sessionId claim from authenticated credentials when available', () => {
    const request = buildRequest(
      { sessionId: 'yar-session-123' },
      { sessionId: 'session-123', sid: 'sid-123' }
    )

    expect(getSessionCorrelationId(request)).toBe('session-123')
  })

  test('falls back to the yar user claims before auth credentials are available', () => {
    const request = buildRequest({ sessionId: 'session-123', sid: 'sid-123' })

    expect(getSessionCorrelationId(request)).toBe('session-123')
  })

  test('falls back claim-by-claim when authenticated credentials are missing the id', () => {
    const request = buildRequest(
      { sessionId: 'yar-session-123' },
      { sub: 'user-123' }
    )

    expect(getSessionCorrelationId(request)).toBe('yar-session-123')
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
  test('registers onRequest and onPostAuth extensions', () => {
    const server = buildServer()

    sessionCorrelation.plugin.register(server)

    expect(server.ext).toHaveBeenCalledWith('onRequest', expect.any(Function))
    expect(server.ext).toHaveBeenCalledWith('onPostAuth', expect.any(Function))
  })

  test('stores the session correlation id on request plugins', () => {
    const server = buildServer()
    const request = buildRequest({ sessionId: 'session-123' })
    const h = { continue: Symbol('continue') }

    sessionCorrelation.plugin.register(server)
    const result = server._extensions.onPostAuth(request, h)

    expect(request.plugins['session-correlation']).toEqual({
      correlationId: 'session-123'
    })
    expect(result).toBe(h.continue)
  })

  test('exposes the session correlation id throughout the wrapped lifecycle', () => {
    const server = buildServer()
    const h = { continue: Symbol('continue') }
    const request = buildRequest({ sessionId: 'session-123' })

    sessionCorrelation.plugin.register(server)
    request._lifecycle = vi.fn(() => {
      server._extensions.onPostAuth(request, h)
      return getCorrelationId()
    })

    server._extensions.onRequest(request, h)

    expect(request._lifecycle()).toBe('session-123')
    expect(getCorrelationId()).toBeNull()
  })

  test('stores null when no correlation id is available', () => {
    const server = buildServer()
    const request = buildRequest({ sub: 'user-123' })
    const h = { continue: Symbol('continue') }

    sessionCorrelation.plugin.register(server)
    server._extensions.onPostAuth(request, h)

    expect(request.plugins['session-correlation']).toEqual({
      correlationId: null
    })
  })
})

describe('#sessionCorrelation response logging', () => {
  test('prefixes the hapi-pino response log message with the session id', async () => {
    const { stream, logs } = captureLogStream()
    const server = Hapi.server()

    server.auth.scheme('test-auth', () => ({
      authenticate: (_request, h) =>
        h.authenticated({ credentials: { sessionId: 'session-123' } })
    }))
    server.auth.strategy('test-auth', 'test-auth')
    server.auth.default('test-auth')

    const logger = pino(
      {
        hooks: loggerOptions.hooks,
        mixin: loggerOptions.mixin,
        level: 'info'
      },
      stream
    )

    await server.register({
      plugin: hapiPino,
      options: {
        instance: logger,
        logEvents: ['response'],
        logRequestComplete: true
      }
    })
    await server.register(sessionCorrelation)

    server.route({
      method: 'GET',
      path: '/',
      handler: () => 'ok'
    })

    await server.inject('/')
    await new Promise((resolve) => setImmediate(resolve))

    const responseLog = logs.find((log) =>
      logMessage(log)?.includes('[response]')
    )

    expect(
      logMessage(responseLog)?.startsWith('[session.id=session-123]')
    ).toBe(true)
    expect(responseLog).not.toHaveProperty('session')
  })
})
