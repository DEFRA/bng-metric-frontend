import Boom from '@hapi/boom'
import { vi } from 'vitest'

import { validateBaseline, validatePostIntervention } from './baseline.js'
import { wreck } from '../helpers/wreck-client.js'

const mockLoggerError = vi.hoisted(() => vi.fn())

vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError
  })
}))

vi.mock('../helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const projectId = '11111111-2222-3333-4444-555555555555'
const uploadId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

// backendRequest reads the id_token from the yar session and forwards it as a
// Bearer header, so the validation calls now take a request as first arg.
function makeRequest(idToken = 'test-id-token') {
  return { yar: { get: vi.fn().mockReturnValue({ idToken }) } }
}

describe('#validateBaseline', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should return valid:true when backend reports file is valid', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: true }
    })

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({ valid: true })
  })

  test('Should forward the structured error array when invalid', async () => {
    const errors = [
      { code: 'NO_HABITAT_AREAS', ac: 'AC3', message: 'No habitat areas' },
      {
        code: 'AREA_PARCELS_OUTSIDE_REDLINE',
        ac: 'AC8',
        message: 'Areas outside redline',
        offendingFeatures: [{ id: 1 }]
      }
    ]
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: false, errors }
    })

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({ valid: false, errors })
  })

  test('Should default to an empty errors array when payload omits one', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: false }
    })

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({ valid: false, errors: [] })
  })

  test('Should forward structured errors from a 4xx response', async () => {
    const errors = [{ code: 'UPLOAD_NOT_READY', message: 'not ready' }]
    const boomError = {
      output: { statusCode: 422 },
      data: { payload: { valid: false, errors } }
    }
    vi.mocked(wreck.post).mockRejectedValue(boomError)

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({ valid: false, errors })
  })

  test('Should throw a Boom conflict, not a file error, when another edit holds the project', async () => {
    const boomError = {
      output: { statusCode: 409 },
      data: {
        payload: {
          statusCode: 409,
          error: 'Conflict',
          message: 'Another baseline upload for this project is in progress'
        }
      }
    }
    vi.mocked(wreck.post).mockRejectedValue(boomError)

    await expect(
      validateBaseline(makeRequest(), projectId, uploadId)
    ).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 409 }
    })
  })

  test('Should fall back to a single error when 4xx has no errors array', async () => {
    const boomError = {
      output: { statusCode: 400 },
      data: { payload: { error: 'Bad input' } }
    }
    vi.mocked(wreck.post).mockRejectedValue(boomError)

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      { code: 'VALIDATION_FAILED', message: 'Bad input' }
    ])
  })

  test('Should log the backend reason phrase but not its messages', async () => {
    const boomError = {
      output: { statusCode: 400 },
      data: {
        isResponseError: true,
        res: { statusCode: 400 },
        payload: {
          statusCode: 400,
          error: 'Bad Request',
          message: 'echoed user input jane@example.com',
          errors: [{ code: 'INVALID_NAME', message: 'jane@example.com' }]
        }
      },
      message: 'Response Error: 400 Bad Request'
    }
    vi.mocked(wreck.post).mockRejectedValue(boomError)

    await validateBaseline(makeRequest(), projectId, uploadId)

    const logged = mockLoggerError.mock.calls.at(-1)[0]
    expect(logged).toContain(
      'body: {"error":"Bad Request","errorCodes":["INVALID_NAME"]}'
    )
    expect(logged).not.toContain('jane@example.com')
  })

  test('Should throw a Boom badGateway error on 5xx response from backend', async () => {
    const boomError = {
      output: { statusCode: 500 },
      data: { payload: {} },
      message: 'Internal Server Error'
    }
    vi.mocked(wreck.post).mockRejectedValue(boomError)

    await expect(
      validateBaseline(makeRequest(), projectId, uploadId)
    ).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  // 503 is the backend saying every geometry-validation worker is busy and the
  // file was never looked at. It must NOT become a badGateway: there is nothing
  // wrong with the upload, and the user's next action is simply to retry.
  /** A 503 from the backend, optionally carrying a Retry-After header. */
  const busyResponse = (headers) => ({
    output: { statusCode: 503 },
    data: {
      payload: {
        valid: false,
        errors: [{ code: 'VALIDATION_BUSY', message: 'The service is busy' }]
      },
      res: { headers }
    },
    message: 'Service Unavailable'
  })

  /** A 429 from a backend rate limit, as wreck rejects with it. */
  const rateLimitedResponse = (retryAfter) => {
    const error = new Error('Response Error: 429 Too Many Requests')
    error.data = {
      isResponseError: true,
      res: { statusCode: 429, headers: { 'retry-after': retryAfter } },
      payload: { statusCode: 429, error: 'Too Many Requests' }
    }
    return error
  }

  test('Should answer a 429 from a rate limit as busy, so the page waits and asks again', async () => {
    vi.mocked(wreck.post).mockRejectedValue(rateLimitedResponse('20'))
    mockLoggerError.mockClear()

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({
      valid: false,
      busy: true,
      retryAfterSeconds: 20,
      errors: []
    })
    expect(mockLoggerError).not.toHaveBeenCalled()
  })

  test('Should hold a rate-limit wait to the busy maximum of 30 seconds', async () => {
    vi.mocked(wreck.post).mockRejectedValue(rateLimitedResponse('55'))

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result.retryAfterSeconds).toBe(30)
  })

  test('Should report a 503 from the backend as busy rather than an error', async () => {
    vi.mocked(wreck.post).mockRejectedValue(busyResponse({}))

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({
      valid: false,
      busy: true,
      retryAfterSeconds: null,
      errors: []
    })
  })

  // A 503 is also what an ingress returns when it has no healthy backend to
  // reach. Reading that as "busy" would leave the user politely retrying the
  // "Checking your file" page for two minutes while the service is down, so the
  // marker in the body — not the status code — is what decides.
  test.each([
    [
      'an HTML error page from the platform',
      '<html>503 Service Unavailable</html>'
    ],
    ['no body at all', undefined],
    [
      'a JSON body with different errors',
      { valid: false, errors: [{ code: 'VALIDATION_FAILED' }] }
    ]
  ])(
    'Should treat a 503 carrying %s as an error, not busy',
    async (_label, payload) => {
      vi.mocked(wreck.post).mockRejectedValue({
        output: { statusCode: 503 },
        data: { payload, res: { headers: {} } },
        message: 'Service Unavailable'
      })

      await expect(
        validateBaseline(makeRequest(), projectId, uploadId)
      ).rejects.toMatchObject({
        isBoom: true,
        output: { statusCode: 502 }
      })
    }
  )

  // The backend is the side that knows how loaded it is, so it sets the pace.
  test('Should honour a Retry-After header on the 503', async () => {
    vi.mocked(wreck.post).mockRejectedValue(
      busyResponse({ 'retry-after': '7' })
    )

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result.retryAfterSeconds).toBe(7)
  })

  // Treated as a hint, not an instruction: it comes from another service, and a
  // bad value should not hammer the backend or strand the user on a spinner.
  test.each([
    ['absent', undefined],
    ['not a number', 'soon'],
    ['an HTTP-date, which we do not parse', 'Wed, 21 Oct 2026 07:28:00 GMT'],
    ['zero, which would hammer the backend', '0'],
    ['negative', '-5'],
    ['implausibly far in the future', '3600']
  ])('Should ignore a Retry-After that is %s', async (_label, value) => {
    vi.mocked(wreck.post).mockRejectedValue(
      busyResponse(value === undefined ? {} : { 'retry-after': value })
    )

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result.retryAfterSeconds).toBeNull()
  })

  // The 502 the user sees hides which failure it was. The log says, so the
  // cause can be read off it: what answered, or that nothing did.
  test('Should log what answered a 5xx, with its body as text', async () => {
    vi.mocked(wreck.post).mockRejectedValue(
      new Boom.Boom('Response Error: 502 Bad Gateway', {
        statusCode: 502,
        data: {
          isResponseError: true,
          headers: { 'content-type': 'text/html', server: 'nginx' },
          res: { statusCode: 502 },
          payload: Buffer.from('<title>502 Bad Gateway</title>')
        }
      })
    )

    await expect(
      validatePostIntervention(makeRequest(), projectId, uploadId)
    ).rejects.toMatchObject({ output: { statusCode: 502 } })

    const line = mockLoggerError.mock.calls.at(-1)[0]
    expect(line).toContain(
      `Error validating post-intervention habitats - uploadId: ${uploadId}, statusCode: 502, failure: response,`
    )
    expect(line).toContain(
      'server: nginx, body: <title>502 Bad Gateway</title>'
    )
    expect(line).toMatch(/elapsedMs: \d+, timeoutMs: \d+/)
  })

  test('Should log a timeout as a timeout, not the 504 wreck gives it', async () => {
    vi.mocked(wreck.post).mockRejectedValue(
      Boom.gatewayTimeout('Client request timeout')
    )

    await expect(
      validateBaseline(makeRequest(), projectId, uploadId)
    ).rejects.toMatchObject({ output: { statusCode: 502 } })

    expect(mockLoggerError.mock.calls.at(-1)[0]).toContain(
      'statusCode: 504, failure: timeout,'
    )
  })

  test('Should throw a Boom badGateway error on network failure', async () => {
    vi.mocked(wreck.post).mockRejectedValue(new Error('Network failure'))

    await expect(
      validateBaseline(makeRequest(), projectId, uploadId)
    ).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  test('Should call the correct backend URL', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: true }
    })

    await validateBaseline(makeRequest(), projectId, uploadId)

    expect(wreck.post).toHaveBeenCalledWith(
      expect.stringContaining(`/baseline/validate/${uploadId}`),
      expect.any(Object)
    )
  })

  test('Should send the projectId in the JSON request body so the backend can persist against the project', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: true }
    })

    await validateBaseline(makeRequest(), projectId, uploadId)

    expect(wreck.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        payload: JSON.stringify({ projectId }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    )
  })
})

describe('#validatePostIntervention', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should call the post-intervention backend validation URL', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: true }
    })

    const result = await validatePostIntervention(
      makeRequest(),
      projectId,
      uploadId
    )

    expect(result).toEqual({ valid: true })
    expect(wreck.post).toHaveBeenCalledWith(
      expect.stringContaining(`/post-intervention/validate/${uploadId}`),
      expect.objectContaining({
        payload: JSON.stringify({ projectId }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    )
  })
})
