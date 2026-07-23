import { refreshTokenGrant } from 'openid-client'
import { refreshSession } from './refresh-session.js'

vi.mock('openid-client', () => ({
  refreshTokenGrant: vi.fn()
}))

vi.mock('./oidc-client.js', () => ({
  getOidcConfig: vi.fn().mockResolvedValue({})
}))

function makeRequest(auth) {
  const store = { auth }
  return {
    yar: {
      get: vi.fn((key) => store[key]),
      set: vi.fn((key, value) => {
        store[key] = value
      })
    },
    logger: { info: vi.fn(), warn: vi.fn() },
    _store: store
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('refreshSession', () => {
  test('returns null when there is no refresh token', async () => {
    const request = makeRequest({ idToken: 'old', user: {} })
    expect(await refreshSession(request)).toBeNull()
    expect(refreshTokenGrant).not.toHaveBeenCalled()
  })

  test('warns distinctly when there is no refresh token to spend', async () => {
    const request = makeRequest({ idToken: 'old', user: { sub: 'u1' } })

    await refreshSession(request)

    expect(request.logger.warn).toHaveBeenCalledWith(
      { sub: 'u1', hasSession: true },
      expect.stringContaining('no refresh token stored')
    )
  })

  test('refreshes tokens, re-stores them in yar and returns the new id_token', async () => {
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: { sub: 'u1' }
    })
    vi.mocked(refreshTokenGrant).mockResolvedValue({
      id_token: 'new-id',
      refresh_token: 'refresh-2',
      claims: () => ({ sub: 'u1' })
    })

    const result = await refreshSession(request)

    expect(result).toBe('new-id')
    expect(request.yar.set).toHaveBeenCalledWith('auth', {
      user: { sub: 'u1' },
      idToken: 'new-id',
      refreshToken: 'refresh-2'
    })
  })

  test('keeps prior claims that the refreshed id_token omits', async () => {
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: {
        sub: 'u1',
        roles: ['rel-1:BNG Completer:3'],
        relationships: ['rel-1:org-1:Acme Ltd:0:Employee:1']
      }
    })
    vi.mocked(refreshTokenGrant).mockResolvedValue({
      id_token: 'new-id',
      refresh_token: 'refresh-2',
      claims: () => ({ sub: 'u1', exp: 1234567890 })
    })

    await refreshSession(request)

    expect(request._store.auth.user).toEqual({
      sub: 'u1',
      exp: 1234567890,
      roles: ['rel-1:BNG Completer:3'],
      relationships: ['rel-1:org-1:Acme Ltd:0:Employee:1']
    })
  })

  test('keeps the previous refresh token when the provider omits a new one', async () => {
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: { sub: 'u1' }
    })
    vi.mocked(refreshTokenGrant).mockResolvedValue({
      id_token: 'new-id',
      refresh_token: undefined,
      claims: () => ({ sub: 'u1' })
    })

    await refreshSession(request)

    expect(request._store.auth.refreshToken).toBe('refresh-1')
  })

  test('returns null and does not throw when the grant fails', async () => {
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1'
    })
    vi.mocked(refreshTokenGrant).mockRejectedValue(new Error('invalid_grant'))

    expect(await refreshSession(request)).toBeNull()
  })

  test('logs PII-safe OAuth error detail when the grant is rejected', async () => {
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: { sub: 'u1' }
    })
    const error = Object.assign(new Error('refresh failed'), {
      code: 'OAUTH_RESPONSE_BODY_ERROR',
      error: 'invalid_grant',
      error_description: 'The refresh token has expired'
    })
    vi.mocked(refreshTokenGrant).mockRejectedValue(error)

    await refreshSession(request)

    expect(request.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        detail: expect.stringContaining('oauthError=invalid_grant')
      }),
      'OIDC: silent token refresh failed'
    )
  })
})
