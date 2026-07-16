import { wreck } from '../wreck-client.js'
import { recordLoginAuditFailure } from './auth-metrics.js'
import { recordLoginAudit } from './record-login-audit.js'

vi.mock('../wreck-client.js', () => ({ wreck: { post: vi.fn() } }))
vi.mock('./auth-metrics.js', () => ({ recordLoginAuditFailure: vi.fn() }))

function makeRequest() {
  return { logger: { warn: vi.fn(), info: vi.fn() } }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('recordLoginAudit', () => {
  test('POSTs the bearer token to /auth/login-audit on success', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 204 } })

    await recordLoginAudit(makeRequest(), 'id-token-1')

    expect(wreck.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login-audit'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer id-token-1' }
      })
    )
    expect(recordLoginAuditFailure).not.toHaveBeenCalled()
  })

  test('records a metric and does not throw on a non-2xx response', async () => {
    vi.mocked(wreck.post).mockResolvedValue({ res: { statusCode: 500 } })

    await expect(
      recordLoginAudit(makeRequest(), 'id-token-1')
    ).resolves.toBeUndefined()
    expect(recordLoginAuditFailure).toHaveBeenCalled()
  })

  test('records a metric and does not throw when wreck rejects', async () => {
    vi.mocked(wreck.post).mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      recordLoginAudit(makeRequest(), 'id-token-1')
    ).resolves.toBeUndefined()
    expect(recordLoginAuditFailure).toHaveBeenCalled()
  })

  test('does nothing when there is no id_token', async () => {
    await recordLoginAudit(makeRequest(), undefined)
    expect(wreck.post).not.toHaveBeenCalled()
  })
})
