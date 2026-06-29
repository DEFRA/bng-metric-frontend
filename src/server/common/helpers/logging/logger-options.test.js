import { getTraceId } from '@defra/hapi-tracing'

import { getCorrelationId } from './session-correlation.js'
import { loggerOptions } from './logger-options.js'

vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: vi.fn()
}))

vi.mock('./session-correlation.js', () => ({
  getCorrelationId: vi.fn()
}))

describe('#loggerOptions', () => {
  describe('#mixin', () => {
    test('Should prefer session correlation id when available', () => {
      getCorrelationId.mockReturnValue('session-correlation-id')
      getTraceId.mockReturnValue('test-trace-id')

      const result = loggerOptions.mixin()

      expect(result).toEqual({ trace: { id: 'session-correlation-id' } })
    })

    test('Should fall back to trace id when no session correlation id is available', () => {
      getCorrelationId.mockReturnValue(null)
      getTraceId.mockReturnValue('test-trace-id')

      const result = loggerOptions.mixin()

      expect(result).toEqual({ trace: { id: 'test-trace-id' } })
    })

    test('Should return empty object when no correlation or trace id', () => {
      getCorrelationId.mockReturnValue(null)
      getTraceId.mockReturnValue(null)

      const result = loggerOptions.mixin()

      expect(result).toEqual({})
    })
  })
})
