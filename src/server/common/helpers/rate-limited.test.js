import { createServer } from '../../server.js'
import { statusCodes } from '../constants.js'
import { wreck } from './wreck-client.js'
import {
  isRateLimited,
  rateLimitedError,
  rateLimitedErrorFor,
  retryAfterSeconds
} from './rate-limited.js'

const mockLoggerError = vi.hoisted(() => vi.fn())

vi.mock('./wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('./logging/logger.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: mockLoggerError
    })
  }
})

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

// Rendering a view in a unit test logs that the built assets are missing,
// which has nothing to do with these tests.
const ASSETS_NOT_BUILT = 'assets-manifest.json not found'

/** The error log lines, other than the missing built assets. */
function errorLogs() {
  return mockLoggerError.mock.calls
    .map(([message]) => String(message))
    .filter((message) => !message.includes(ASSETS_NOT_BUILT))
}

/** What wreck throws for a backend 429: the response is on `data.res`. */
function backendTooManyRequests(retryAfter) {
  const error = new Error('Response Error: 429 Too Many Requests')
  error.data = {
    isResponseError: true,
    res: {
      statusCode: statusCodes.tooManyRequests,
      headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter }
    },
    payload: { statusCode: statusCodes.tooManyRequests }
  }
  return error
}

describe('#retryAfterSeconds', () => {
  test.each([
    ['30', 30],
    [' 7 ', 7],
    ['1', 1]
  ])('reads Retry-After: %s as %s seconds', (value, expected) => {
    expect(retryAfterSeconds({ 'retry-after': value })).toBe(expected)
  })

  test.each([
    ['no header', {}],
    ['no headers at all', undefined],
    ['zero', { 'retry-after': '0' }],
    ['a date', { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }],
    ['a fraction', { 'retry-after': '1.5' }],
    ['a negative number', { 'retry-after': '-3' }]
  ])('gives null for %s', (_, headers) => {
    expect(retryAfterSeconds(headers)).toBeNull()
  })
})

describe('#rateLimitedErrorFor', () => {
  test('is a 429 carrying the wait for a backend 429', () => {
    const error = rateLimitedErrorFor({
      statusCode: statusCodes.tooManyRequests,
      headers: { 'retry-after': '12' }
    })

    expect(error.output.statusCode).toBe(statusCodes.tooManyRequests)
    expect(error.data).toEqual({ rateLimited: true, retryAfterSeconds: 12 })
    expect(isRateLimited(error)).toBe(true)
  })

  test('is null for any other status', () => {
    expect(rateLimitedErrorFor({ statusCode: statusCodes.ok })).toBeNull()
    expect(
      rateLimitedErrorFor({ statusCode: statusCodes.serviceUnavailable })
    ).toBeNull()
    expect(rateLimitedErrorFor(undefined)).toBeNull()
  })

  test('isRateLimited is false for other errors', () => {
    expect(isRateLimited(new Error('boom'))).toBe(false)
    expect(isRateLimited(undefined)).toBe(false)
    expect(isRateLimited(rateLimitedError({}))).toBe(true)
  })
})

describe('the "too many requests" page', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when the backend refuses the upload start', () => {
    function openUploadPage() {
      return server.inject({
        method: 'GET',
        url: `/projects/${PROJECT_ID}/upload-baseline-file`,
        auth
      })
    }

    beforeEach(() => {
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: statusCodes.ok },
        payload: { project: { name: 'Test Project' } }
      })
      vi.mocked(wreck.post).mockRejectedValue(backendTooManyRequests('42'))
    })

    test('shows the page with the time to wait, as a 429', async () => {
      const response = await openUploadPage()

      expect(response.statusCode).toBe(statusCodes.tooManyRequests)
      expect(response.headers['retry-after']).toBe('42')
      expect(response.result).toContain('Too many requests')
      expect(response.result).toContain('Wait 42 seconds, then try again.')
    })

    test('does not show the problem-with-the-service page', async () => {
      const { result } = await openUploadPage()

      expect(result).not.toContain('Something went wrong')
      expect(result).not.toContain('Sorry, there is a problem')
    })

    test('is not logged as a backend failure or a server error', async () => {
      await openUploadPage()

      expect(errorLogs()).toEqual([])
    })
  })

  describe('when the backend refuses the PDF report', () => {
    function getReport() {
      return server.inject({
        method: 'GET',
        url: `/projects/${PROJECT_ID}/report.pdf`,
        auth
      })
    }

    test('shows the page with the time to wait, as a 429', async () => {
      vi.mocked(wreck.get).mockRejectedValue(backendTooManyRequests('30'))

      const response = await getReport()

      expect(response.statusCode).toBe(statusCodes.tooManyRequests)
      expect(response.headers['retry-after']).toBe('30')
      expect(response.headers['content-disposition']).toBeUndefined()
      expect(response.result).toContain('Wait 30 seconds, then try again.')
      expect(errorLogs()).toEqual([])
    })

    test('says 1 second in the singular', async () => {
      vi.mocked(wreck.get).mockRejectedValue(backendTooManyRequests('1'))

      const { result } = await getReport()

      expect(result).toContain('Wait 1 second, then try again.')
    })

    test('asks for a minute when the backend gives no wait', async () => {
      vi.mocked(wreck.get).mockRejectedValue(backendTooManyRequests())

      const response = await getReport()

      expect(response.statusCode).toBe(statusCodes.tooManyRequests)
      expect(response.headers['retry-after']).toBeUndefined()
      expect(response.result).toContain('Wait a minute, then try again.')
    })
  })
})
