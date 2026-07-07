import { getTraceId } from '@defra/hapi-tracing'

import { getCorrelationId } from './session-correlation.js'
import { loggerOptions } from './logger-options.js'

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
  describe('#mixin', () => {
    test('Should add trace id and session id when no bindings are available', () => {
      getTraceId.mockReturnValue('test-trace-id')
      getCorrelationId.mockReturnValue('session-correlation-id')

      const result = loggerOptions.mixin({}, 30, loggerWithBindings({}))

      expect(result).toEqual({
        trace: { id: 'test-trace-id' },
        session: { id: 'session-correlation-id' }
      })
    })

    test('Should not overwrite existing trace or session bindings', () => {
      getTraceId.mockReturnValue('test-trace-id')
      getCorrelationId.mockReturnValue('session-correlation-id')

      const result = loggerOptions.mixin(
        {},
        30,
        loggerWithBindings({
          trace: { id: 'bound-trace-id' },
          session: { id: 'bound-session-id' }
        })
      )

      expect(result).toEqual({})
    })

    test('Should still add session id when logger already has a trace binding', () => {
      getTraceId.mockReturnValue('test-trace-id')
      getCorrelationId.mockReturnValue('session-correlation-id')

      const result = loggerOptions.mixin(
        {},
        30,
        loggerWithBindings({ trace: { id: 'bound-trace-id' } })
      )

      expect(result).toEqual({
        session: { id: 'session-correlation-id' }
      })
    })

    test('Should still add trace id when logger already has a session binding', () => {
      getTraceId.mockReturnValue('test-trace-id')
      getCorrelationId.mockReturnValue('session-correlation-id')

      const result = loggerOptions.mixin(
        {},
        30,
        loggerWithBindings({ session: { id: 'bound-session-id' } })
      )

      expect(result).toEqual({ trace: { id: 'test-trace-id' } })
    })

    test('Should return empty object when no trace id or session id is available', () => {
      getTraceId.mockReturnValue(null)
      getCorrelationId.mockReturnValue(null)

      const result = loggerOptions.mixin({}, 30, loggerWithBindings({}))

      expect(result).toEqual({})
    })
  })
})
