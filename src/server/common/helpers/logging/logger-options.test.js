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
    test('Should return empty object when logger already has a trace binding', () => {
      getCorrelationId.mockReturnValue('session-correlation-id')
      getTraceId.mockReturnValue('test-trace-id')

      const result = loggerOptions.mixin(
        {},
        30,
        loggerWithBindings({ trace: { id: 'session-correlation-id' } })
      )

      expect(result).toEqual({})
      expect(getCorrelationId).not.toHaveBeenCalled()
      expect(getTraceId).not.toHaveBeenCalled()
    })

    test('Should prefer session correlation id when no trace binding is available', () => {
      getCorrelationId.mockReturnValue('session-correlation-id')
      getTraceId.mockReturnValue('test-trace-id')

      const result = loggerOptions.mixin({}, 30, loggerWithBindings({}))

      expect(result).toEqual({ trace: { id: 'session-correlation-id' } })
    })

    test('Should fall back to trace id when no trace binding or session correlation id is available', () => {
      getCorrelationId.mockReturnValue(null)
      getTraceId.mockReturnValue('test-trace-id')

      const result = loggerOptions.mixin({}, 30, loggerWithBindings({}))

      expect(result).toEqual({ trace: { id: 'test-trace-id' } })
    })

    test('Should return empty object when no trace binding, session correlation id or trace id', () => {
      getCorrelationId.mockReturnValue(null)
      getTraceId.mockReturnValue(null)

      const result = loggerOptions.mixin({}, 30, loggerWithBindings({}))

      expect(result).toEqual({})
    })
  })
})
