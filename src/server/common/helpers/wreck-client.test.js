import { withTraceId } from '@defra/hapi-tracing'

import { wreck } from './wreck-client.js'

const mocks = vi.hoisted(() => {
  const client = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }

  return {
    client,
    defaults: vi.fn(() => client)
  }
})

vi.mock('@defra/hapi-tracing', () => ({
  withTraceId: vi.fn((headerName, headers) => ({
    ...headers,
    [headerName]: 'trace-1'
  }))
}))

vi.mock('@hapi/wreck', () => ({
  default: { defaults: mocks.defaults }
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('wreck client', () => {
  test.each(['get', 'post', 'put', 'patch', 'delete'])(
    'adds the current trace ID to %s requests',
    async (method) => {
      mocks.client[method].mockResolvedValue({ res: { statusCode: 200 } })

      await wreck[method]('http://backend.test/resource', {
        headers: { 'Content-Type': 'application/json' },
        payload: '{}'
      })

      expect(withTraceId).toHaveBeenCalledWith('x-cdp-request-id', {
        'Content-Type': 'application/json'
      })
      expect(mocks.client[method]).toHaveBeenCalledWith(
        'http://backend.test/resource',
        {
          headers: {
            'Content-Type': 'application/json',
            'x-cdp-request-id': 'trace-1'
          },
          payload: '{}'
        }
      )
    }
  )
})
