import { wreck } from '../wreck-client.js'
import { recordSessionPersistFailure } from './auth-metrics.js'
import { buildAuthHeaders } from './build-auth-headers.js'
import { persistBackendSession } from './persist-session.js'

vi.mock('../wreck-client.js', () => ({ wreck: { post: vi.fn() } }))
vi.mock('./auth-metrics.js', () => ({ recordSessionPersistFailure: vi.fn() }))
vi.mock('./build-auth-headers.js', () => ({ buildAuthHeaders: vi.fn() }))

const SIGNED_HEADERS = {
  'x-defra-id-token': 'base64-token',
  'x-defra-id-signature': 'hex-signature'
}

function makeRequest() {
  return { logger: { warn: vi.fn(), info: vi.fn() } }
}

beforeEach(() => {
  vi.mocked(buildAuthHeaders).mockReturnValue(SIGNED_HEADERS)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('persistBackendSession', () => {
  test('POSTs the signed forwarding headers to /auth/session on success', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 204 } })

    await persistBackendSession(makeRequest(), 'id-token-1')

    expect(buildAuthHeaders).toHaveBeenCalledWith('id-token-1')
    expect(wreck.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/session'),
      expect.objectContaining({ headers: SIGNED_HEADERS })
    )
    expect(recordSessionPersistFailure).not.toHaveBeenCalled()
  })

  test('never sends an Authorization / Bearer header', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 204 } })

    await persistBackendSession(makeRequest(), 'id-token-1')

    const [, sentOptions] = vi.mocked(wreck.post).mock.calls[0]
    expect(sentOptions.headers).not.toHaveProperty('Authorization')
  })

  test('records a metric and does not throw on a non-2xx response', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 500 } })

    await expect(
      persistBackendSession(makeRequest(), 'id-token-1')
    ).resolves.toBeUndefined()
    expect(recordSessionPersistFailure).toHaveBeenCalled()
  })

  test('records a metric and does not throw when wreck rejects', async () => {
    vi.mocked(wreck.post).mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      persistBackendSession(makeRequest(), 'id-token-1')
    ).resolves.toBeUndefined()
    expect(recordSessionPersistFailure).toHaveBeenCalled()
  })

  test('does nothing when there is no id_token', async () => {
    await persistBackendSession(makeRequest(), undefined)
    expect(wreck.post).not.toHaveBeenCalled()
    expect(buildAuthHeaders).not.toHaveBeenCalled()
  })
})
