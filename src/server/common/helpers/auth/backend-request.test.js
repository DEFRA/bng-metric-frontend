import { wreck } from '../wreck-client.js'
import { buildAuthHeaders } from './build-auth-headers.js'
import { isTokenCurrentlyValid } from './confirm-token-valid.js'
import { refreshSession } from './refresh-session.js'
import { backendRequest } from './backend-request.js'

vi.mock('../wreck-client.js', () => ({
  wreck: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }
}))

vi.mock('./refresh-session.js', () => ({
  refreshSession: vi.fn()
}))

vi.mock('./confirm-token-valid.js', () => ({
  isTokenCurrentlyValid: vi.fn()
}))

vi.mock('./build-auth-headers.js', () => ({
  buildAuthHeaders: vi.fn()
}))

const URL = 'http://backend.test/projects/1'
const SIGNED_HEADERS = {
  'x-defra-id-token': 'base64-token',
  'x-defra-id-signature': 'hex-signature'
}

function makeRequest(idToken = 'token-1') {
  return { yar: { get: vi.fn().mockReturnValue({ idToken }) } }
}

beforeEach(() => {
  vi.mocked(isTokenCurrentlyValid).mockReturnValue(true)
  vi.mocked(buildAuthHeaders).mockReturnValue(SIGNED_HEADERS)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('backendRequest', () => {
  test('attaches the signed forwarding headers and returns the result on success', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { ok: true }
    })

    const result = await backendRequest(makeRequest(), 'get', URL)

    expect(result.payload).toEqual({ ok: true })
    expect(wreck.get).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({
        headers: expect.objectContaining(SIGNED_HEADERS)
      })
    )
    expect(refreshSession).not.toHaveBeenCalled()
  })

  test('never sends an Authorization / Bearer header', async () => {
    vi.mocked(wreck.get).mockResolvedValue({ res: { statusCode: 200 } })

    await backendRequest(makeRequest(), 'get', URL)

    const [, sentOptions] = vi.mocked(wreck.get).mock.calls[0]
    expect(sentOptions.headers).not.toHaveProperty('Authorization')
  })

  test('merges caller headers with the signed forwarding headers', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 200 } })

    await backendRequest(makeRequest(), 'post', URL, {
      headers: { 'Content-Type': 'application/json' },
      payload: '{}'
    })

    expect(wreck.post).toHaveBeenCalledWith(URL, {
      headers: {
        'Content-Type': 'application/json',
        ...SIGNED_HEADERS
      },
      payload: '{}'
    })
  })

  test('refreshes proactively when the stored token is expired, then forwards the refreshed token', async () => {
    vi.mocked(isTokenCurrentlyValid).mockReturnValue(false)
    vi.mocked(refreshSession).mockResolvedValue('fresh-token')
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { ok: true }
    })

    const result = await backendRequest(makeRequest(), 'get', URL)

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(buildAuthHeaders).toHaveBeenCalledWith('fresh-token')
    expect(result.res.statusCode).toBe(200)
  })

  test('returns 401 without calling the backend when an expired token cannot be refreshed', async () => {
    vi.mocked(isTokenCurrentlyValid).mockReturnValue(false)
    vi.mocked(refreshSession).mockResolvedValue(null)

    const result = await backendRequest(makeRequest(), 'get', URL)

    expect(result.res.statusCode).toBe(401)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('proceeds without auth headers when there is no session token', async () => {
    // The auth scheme redirects unauthenticated users upstream, so reaching here
    // with no token only happens in tests/edge cases: fall back to an unsigned
    // call (the backend will 401) rather than refusing locally.
    vi.mocked(buildAuthHeaders).mockReturnValue({})
    vi.mocked(wreck.get).mockResolvedValue({ res: { statusCode: 200 } })
    const request = { yar: { get: vi.fn().mockReturnValue(undefined) } }

    const result = await backendRequest(request, 'get', URL)

    expect(result.res.statusCode).toBe(200)
    expect(wreck.get).toHaveBeenCalledTimes(1)
    expect(buildAuthHeaders).toHaveBeenCalledWith(undefined)
    expect(isTokenCurrentlyValid).not.toHaveBeenCalled()
  })

  test('refreshes once and retries on a 401 result from the backend', async () => {
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
    expect(buildAuthHeaders).toHaveBeenLastCalledWith('new-token')
    expect(result.res.statusCode).toBe(200)
  })

  test('does not retry when the refresh fails, returning the 401 result', async () => {
    vi.mocked(wreck.get).mockResolvedValue({ res: { statusCode: 401 } })
    vi.mocked(refreshSession).mockResolvedValue(null)

    const result = await backendRequest(makeRequest(), 'get', URL)

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(wreck.get).toHaveBeenCalledTimes(1)
    expect(result.res.statusCode).toBe(401)
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
})
