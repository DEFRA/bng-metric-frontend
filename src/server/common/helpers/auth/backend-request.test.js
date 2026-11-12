import { wreck } from '../wreck-client.js'
import { refreshSession } from './refresh-session.js'
import { backendRequest } from './backend-request.js'

vi.mock('../wreck-client.js', () => ({
  wreck: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }
}))

vi.mock('./refresh-session.js', () => ({
  refreshSession: vi.fn()
}))

const URL = 'http://backend.test/projects/1'

function makeRequest(idToken = 'token-1') {
  return {
    yar: {
      get: vi.fn().mockReturnValue({ idToken }),
      set: vi.fn(),
      reset: vi.fn()
    }
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('backendRequest', () => {
  test('attaches the bearer token and returns the result on success', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { ok: true }
    })

    const result = await backendRequest(makeRequest(), 'get', URL)

    expect(result.payload).toEqual({ ok: true })
    expect(wreck.get).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' })
      })
    )
    expect(refreshSession).not.toHaveBeenCalled()
  })

  test('merges caller headers with the bearer header', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 200 } })

    await backendRequest(makeRequest(), 'post', URL, {
      headers: { 'Content-Type': 'application/json' },
      payload: '{}'
    })

    expect(wreck.post).toHaveBeenCalledWith(URL, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-1'
      },
      payload: '{}'
    })
  })

  test('refreshes once and retries on a 401 result', async () => {
    vi.mocked(wreck.get)
      .mockResolvedValueOnce({ res: { statusCode: 401 } })
      .mockResolvedValueOnce({
        res: { statusCode: 200 },
        payload: { ok: true }
      })
    vi.mocked(refreshSession).mockResolvedValue('new-token')

    const result = await backendRequest(makeRequest(), 'get', URL)

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(wreck.get).toHaveBeenCalledTimes(2)
    expect(result.res.statusCode).toBe(200)
  })

  test('clears the session and throws a session-expired error when the refresh fails', async () => {
    vi.mocked(wreck.get).mockResolvedValue({ res: { statusCode: 401 } })
    vi.mocked(refreshSession).mockResolvedValue(null)
    const request = makeRequest()

    await expect(backendRequest(request, 'get', URL)).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 401 },
      data: { sessionExpired: true }
    })

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(wreck.get).toHaveBeenCalledTimes(1)
    expect(request.yar.reset).toHaveBeenCalledTimes(1)
  })

  test('clears the session and throws session-expired when a thrown 401 cannot be refreshed', async () => {
    const boom401 = Object.assign(new Error('Unauthorized'), {
      output: { statusCode: 401 }
    })
    vi.mocked(wreck.get).mockRejectedValue(boom401)
    vi.mocked(refreshSession).mockResolvedValue(null)
    const request = makeRequest()

    await expect(backendRequest(request, 'get', URL)).rejects.toMatchObject({
      data: { sessionExpired: true }
    })
    expect(request.yar.reset).toHaveBeenCalledTimes(1)
  })

  test('refreshes and retries on a thrown 401 (Boom-shaped) error', async () => {
    const boom401 = Object.assign(new Error('Unauthorized'), {
      output: { statusCode: 401 }
    })
    vi.mocked(wreck.get)
      .mockRejectedValueOnce(boom401)
      .mockResolvedValueOnce({
        res: { statusCode: 200 },
        payload: { ok: true }
      })
    vi.mocked(refreshSession).mockResolvedValue('new-token')

    const result = await backendRequest(makeRequest(), 'get', URL)

    expect(result.res.statusCode).toBe(200)
    expect(wreck.get).toHaveBeenCalledTimes(2)
  })

  test('rethrows a non-401 error without refreshing', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('network down'))

    await expect(backendRequest(makeRequest(), 'get', URL)).rejects.toThrow(
      'network down'
    )
    expect(refreshSession).not.toHaveBeenCalled()
  })

  describe('a 429 from a backend rate limit', () => {
    test('is thrown as a rate-limited 429 when wreck rejects with it', async () => {
      const error = new Error('Response Error: 429 Too Many Requests')
      error.data = {
        isResponseError: true,
        res: { statusCode: 429, headers: { 'retry-after': '25' } }
      }
      vi.mocked(wreck.get).mockRejectedValue(error)

      await expect(
        backendRequest(makeRequest(), 'get', URL)
      ).rejects.toMatchObject({
        output: { statusCode: 429 },
        data: { rateLimited: true, retryAfterSeconds: 25 }
      })
      expect(refreshSession).not.toHaveBeenCalled()
    })

    test('is thrown as a rate-limited 429 when wreck returns it', async () => {
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: 429, headers: { 'retry-after': '9' } },
        payload: null
      })

      await expect(
        backendRequest(makeRequest(), 'get', URL)
      ).rejects.toMatchObject({
        output: { statusCode: 429 },
        data: { rateLimited: true, retryAfterSeconds: 9 }
      })
    })

    test('leaves any other error as it was', async () => {
      const error = new Error('Response Error: 500 Internal Server Error')
      error.data = { isResponseError: true, res: { statusCode: 500 } }
      vi.mocked(wreck.get).mockRejectedValue(error)

      await expect(backendRequest(makeRequest(), 'get', URL)).rejects.toBe(
        error
      )
    })
  })
})
