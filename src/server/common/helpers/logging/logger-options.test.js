import { getTraceId } from '@defra/hapi-tracing'

import { getCorrelationId } from './session-correlation.js'
import { loggerOptions, prefixMessageWithSessionId } from './logger-options.js'

vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: vi.fn()
}))

vi.mock('./session-correlation.js', () => ({
  getCorrelationId: vi.fn()
}))

function loggerWithBindings(bindings) {
  return { bindings: vi.fn().mockReturnValue(bindings) }
}

describe('#loggerOptions', () => {
  describe('#prefixMessageWithSessionId', () => {
    test('Should prefix the first message string with the session id', () => {
      const result = prefixMessageWithSessionId(
        [{ route: '/test' }, 'Test message'],
        'session-correlation-id'
      )

      expect(result).toEqual([
        { route: '/test' },
        '[session.id=session-correlation-id] Test message'
      ])
    })

    test('Should add a message when no message string exists', () => {
      const result = prefixMessageWithSessionId(
        [{ route: '/test' }],
        'session-correlation-id'
      )

      expect(result).toEqual([
        { route: '/test' },
        '[session.id=session-correlation-id]'
      ])
    })

    test('Should not add a second session id prefix', () => {
      const result = prefixMessageWithSessionId(
        ['[session.id=session-correlation-id] Test message'],
        'session-correlation-id'
      )

      expect(result).toEqual([
        '[session.id=session-correlation-id] Test message'
      ])
    })

    test('Should return the original args when no session id is available', () => {
      const args = ['Test message']

      const result = prefixMessageWithSessionId(args, null)

      expect(result).toBe(args)
    })
  })

  describe('#hooks.logMethod', () => {
    test('Should prefix log messages with the current session id', () => {
      getCorrelationId.mockReturnValue('session-correlation-id')
      const method = vi.fn()

      loggerOptions.hooks.logMethod(['Test message'], method)

      expect(method).toHaveBeenCalledWith(
        '[session.id=session-correlation-id] Test message'
      )
    })

    test('Should leave log messages unchanged when no session id is available', () => {
      getCorrelationId.mockReturnValue(null)
      const method = vi.fn()

      loggerOptions.hooks.logMethod(['Test message'], method)

      expect(method).toHaveBeenCalledWith('Test message')
    })
  })

  describe('#mixin', () => {
    test('Should add trace id when no trace binding is available', () => {
      getTraceId.mockReturnValue('test-trace-id')
      getCorrelationId.mockReturnValue('session-correlation-id')

      const result = loggerOptions.mixin({}, 30, loggerWithBindings({}))

      expect(result).toEqual({ trace: { id: 'test-trace-id' } })
    })

    test('Should not add session id as a structured field', () => {
      getTraceId.mockReturnValue(null)
      getCorrelationId.mockReturnValue('session-correlation-id')

      const result = loggerOptions.mixin({}, 30, loggerWithBindings({}))

      expect(result).toEqual({})
    })

    test('Should not overwrite an existing trace binding', () => {
      getTraceId.mockReturnValue('test-trace-id')
      getCorrelationId.mockReturnValue('session-correlation-id')

      const result = loggerOptions.mixin(
        {},
        30,
        loggerWithBindings({ trace: { id: 'bound-trace-id' } })
      )

      expect(result).toEqual({})
    })

    test('Should return empty object when no trace id is available', () => {
      getTraceId.mockReturnValue(null)
      getCorrelationId.mockReturnValue(null)

      const result = loggerOptions.mixin({}, 30, loggerWithBindings({}))

      expect(result).toEqual({})
    })
  })
})
