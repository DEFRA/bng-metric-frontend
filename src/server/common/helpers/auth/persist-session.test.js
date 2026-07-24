import { wreck } from '../wreck-client.js'
import { persistBackendSession } from './persist-session.js'

vi.mock('../wreck-client.js', () => ({ wreck: { post: vi.fn() } }))

function makeRequest() {
  return { logger: { warn: vi.fn(), info: vi.fn() } }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('persistBackendSession', () => {
  test('POSTs the bearer token to /auth/session on success', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 204 } })

    await persistBackendSession(makeRequest(), 'id-token-1')

    expect(wreck.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/session'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer id-token-1' }
      })
    )
  })

  test('does not throw on a non-2xx response', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 500 } })

    await expect(
      persistBackendSession(makeRequest(), 'id-token-1')
    ).resolves.toBeUndefined()
  })

  test('does not throw when wreck rejects', async () => {
    vi.mocked(wreck.post).mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      persistBackendSession(makeRequest(), 'id-token-1')
    ).resolves.toBeUndefined()
  })

  test('does nothing when there is no id_token', async () => {
    await persistBackendSession(makeRequest(), undefined)
    expect(wreck.post).not.toHaveBeenCalled()
  })
})
