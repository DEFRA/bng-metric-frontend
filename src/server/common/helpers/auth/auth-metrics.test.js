import { describe, test, expect, vi } from 'vitest'

import {
  recordLoginSuccess,
  recordLoginFailure,
  LOGIN_METRIC,
  LOGIN_FAILURE_REASON
} from './auth-metrics.js'

// The @defra/cdp-metrics plugin decorates `request.metrics` with the Metrics
// instance itself, so it is an object with a `counter` method — not a function.
function buildRequest() {
  const counter = vi.fn()
  const request = {
    metrics: { counter },
    logger: { warn: vi.fn() }
  }
  return { request, counter }
}

describe('#auth-metrics', () => {
  describe('recordLoginSuccess', () => {
    test('emits a LoginSucceeded counter with no dimensions', async () => {
      const { request, counter } = buildRequest()

      await recordLoginSuccess(request)

      expect(counter).toHaveBeenCalledWith(LOGIN_METRIC.succeeded)
    })

    test('swallows errors so login is never broken', async () => {
      const { request, counter } = buildRequest()
      counter.mockImplementation(() => {
        throw new Error('metrics down')
      })

      await expect(recordLoginSuccess(request)).resolves.toBeUndefined()
      expect(request.logger.warn).toHaveBeenCalled()
    })
  })

  describe('recordLoginFailure', () => {
    test('emits a LoginFailed counter with the reason dimension', async () => {
      const { request, counter } = buildRequest()

      await recordLoginFailure(request, LOGIN_FAILURE_REASON.rbac)

      expect(counter).toHaveBeenCalledWith(LOGIN_METRIC.failed, 1, {
        reason: LOGIN_FAILURE_REASON.rbac
      })
    })

    test('swallows errors so login is never broken', async () => {
      const { request, counter } = buildRequest()
      counter.mockImplementation(() => {
        throw new Error('metrics down')
      })

      await expect(
        recordLoginFailure(request, LOGIN_FAILURE_REASON.tokenExchange)
      ).resolves.toBeUndefined()
      expect(request.logger.warn).toHaveBeenCalled()
    })
  })
})
