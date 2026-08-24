import { refreshTokenGrant } from 'openid-client'
import {
  REFRESH_ERROR,
  classifyRefreshError,
  refreshSession
} from './refresh-session.js'

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
      expect.objectContaining({
        sub: 'u1',
        hasSession: true,
        category: 'no-refresh-token'
      }),
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

  test('keeps prior claims that the refreshed id_token blanks (empty array / string)', async () => {
    // The BMD-829 regression: Defra ID (B2C) re-runs enrichment only on
    // interactive sign-in, so a refresh_token grant can echo the enrichment
    // claims back EMPTY rather than omitting them. Empty values must not
    // overwrite the good login-time claims.
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: {
        sub: 'u1',
        roles: ['rel-1:BNG Completer:3'],
        relationships: ['rel-1:org-1:Acme Ltd:0:Employee:1'],
        currentRelationshipId: 'rel-1'
      }
    })
    vi.mocked(refreshTokenGrant).mockResolvedValue({
      id_token: 'new-id',
      refresh_token: 'refresh-2',
      claims: () => ({
        sub: 'u1',
        exp: 1234567890,
        roles: [],
        relationships: [],
        currentRelationshipId: ''
      })
    })

    await refreshSession(request)

    expect(request._store.auth.user).toEqual({
      sub: 'u1',
      exp: 1234567890,
      roles: ['rel-1:BNG Completer:3'],
      relationships: ['rel-1:org-1:Acme Ltd:0:Employee:1'],
      currentRelationshipId: 'rel-1'
    })
  })

  test('lets a meaningfully-present refreshed NON-enrichment claim overwrite the prior one', async () => {
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: { sub: 'u1', email: 'old@example.test' }
    })
    vi.mocked(refreshTokenGrant).mockResolvedValue({
      id_token: 'new-id',
      refresh_token: 'refresh-2',
      claims: () => ({ sub: 'u1', exp: 42, email: 'new@example.test' })
    })

    await refreshSession(request)

    expect(request._store.auth.user).toEqual({
      sub: 'u1',
      exp: 42,
      email: 'new@example.test'
    })
  })

  describe('enrichment claims are pinned to their sign-in values (BMD-936)', () => {
    // Defra ID re-runs relationship/role enrichment only on an interactive
    // sign-in, so nothing a refresh grant returns in these three claims is
    // authoritative. Each case below is a shape observed to overwrite a good
    // sign-in claim before BMD-936, producing a claim set that
    // hasBngCompleterRole then rejected — signing out a user whose refresh had
    // succeeded.
    const signedInUser = {
      sub: 'u1',
      roles: ['rel-1:bng completer:3', 'rel-2:bng completer:3'],
      relationships: ['rel-1:org-1:Acme Ltd:0:Employee:1'],
      currentRelationshipId: 'rel-2'
    }

    test.each([
      [
        'roles flattened to a scalar',
        { roles: 'rel-1:bng completer:3', exp: 42 }
      ],
      [
        'roles returned with a non-approved status',
        { roles: ['rel-1:bng completer:1'], exp: 42 }
      ],
      [
        'currentRelationshipId defaulted to another org',
        { currentRelationshipId: 'rel-1', exp: 42 }
      ],
      [
        'the whole enrichment set repopulated differently',
        {
          roles: ['rel-9:bng completer:6'],
          relationships: ['rel-9:org-9:Other Ltd:0:Employee:1'],
          currentRelationshipId: 'rel-9',
          exp: 42
        }
      ]
    ])(
      'keeps the sign-in claims when the refreshed token has %s',
      async (_name, refreshedClaims) => {
        const request = makeRequest({
          idToken: 'old-id',
          refreshToken: 'refresh-1',
          user: { ...signedInUser }
        })
        vi.mocked(refreshTokenGrant).mockResolvedValue({
          id_token: 'new-id',
          refresh_token: 'refresh-2',
          claims: () => ({ sub: 'u1', ...refreshedClaims })
        })

        await refreshSession(request)

        expect(request._store.auth.user).toEqual({
          ...signedInUser,
          exp: 42
        })
      }
    )
  })

  test('logs the enrichment shapes in the message text, without the values', async () => {
    // CDP drops unmapped structured fields, so the message is the only part that
    // reaches OpenSearch — and it must never carry the claim values themselves
    // (role and relationship strings contain org ids and names).
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: {
        sub: 'u1',
        roles: ['rel-1:bng completer:3'],
        relationships: ['rel-1:org-1:Acme Ltd:0:Employee:1'],
        currentRelationshipId: 'rel-1'
      }
    })
    vi.mocked(refreshTokenGrant).mockResolvedValue({
      id_token: 'new-id',
      refresh_token: 'refresh-2',
      claims: () => ({
        sub: 'u1',
        exp: 42,
        roles: 'rel-1:bng completer:1',
        relationships: [],
        currentRelationshipId: 'rel-2'
      })
    })

    await refreshSession(request)

    const [, message] = request.logger.info.mock.calls.at(-1)
    expect(message).toBe(
      // roles drifts array -> scalar, which is not an id-to-id comparison, so it
      // stays the plain marker; only scalar-vs-scalar drift gets classified.
      'OIDC: silently refreshed session tokens [roles=scalar(differs) relationships=array:0(differs) currentRelationshipId=scalar(differs:unknown)]'
    )
    expect(message).not.toContain('Acme')
    expect(message).not.toContain('rel-2')
  })

  test('does not flag a reordered array claim as differing', async () => {
    // JSON.stringify-based comparison is order-sensitive, but B2C returning
    // the same relationships in a different order is not a meaningful
    // change - only a reordering, not real drift.
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: {
        sub: 'u1',
        roles: ['rel-1:bng completer:3', 'rel-2:bng completer:3']
      }
    })
    vi.mocked(refreshTokenGrant).mockResolvedValue({
      id_token: 'new-id',
      refresh_token: 'refresh-2',
      claims: () => ({
        sub: 'u1',
        exp: 42,
        roles: ['rel-2:bng completer:3', 'rel-1:bng completer:3']
      })
    })

    await refreshSession(request)

    const [, message] = request.logger.info.mock.calls.at(-1)
    expect(message).toContain('roles=array:2 ')
    expect(message).not.toContain('roles=array:2(differs)')
  })

  test('reports enrichment claims the refreshed token omits as absent', async () => {
    const request = makeRequest({
      idToken: 'old-id',
      refreshToken: 'refresh-1',
      user: { sub: 'u1', roles: ['rel-1:bng completer:3'] }
    })
    vi.mocked(refreshTokenGrant).mockResolvedValue({
      id_token: 'new-id',
      refresh_token: 'refresh-2',
      claims: () => ({ sub: 'u1', exp: 42 })
    })

    await refreshSession(request)

    const [, message] = request.logger.info.mock.calls.at(-1)
    expect(message).toContain(
      '[roles=absent(differs) relationships=absent currentRelationshipId=absent]'
    )
  })

  describe('drift classification (BMD-936 follow-up)', () => {
    // The deployed logs showed roles and relationships coming back IDENTICAL
    // while only currentRelationshipId differed - for single- AND
    // multi-relationship users alike. These cases separate the possible causes
    // without ever logging the value: case/format drift is OUR comparison being
    // strict, a known relationship is a real org switch, and `unknown` is the
    // only one worth raising with Defra ID.
    function signedIn(overrides = {}) {
      return {
        idToken: 'old-id',
        refreshToken: 'refresh-1',
        user: {
          sub: 'u1',
          roles: ['rel-1:bng completer:3'],
          relationships: ['rel-1:org-1:Acme Ltd:0:Employee:1'],
          currentRelationshipId: 'rel-1',
          ...overrides
        }
      }
    }

    async function driftFor(refreshedCurrent, sessionOverrides = {}) {
      const request = makeRequest(signedIn(sessionOverrides))
      vi.mocked(refreshTokenGrant).mockResolvedValue({
        id_token: 'new-id',
        refresh_token: 'refresh-2',
        claims: () => ({
          sub: 'u1',
          exp: 42,
          roles: request._store.auth.user.roles,
          relationships: request._store.auth.user.relationships,
          currentRelationshipId: refreshedCurrent
        })
      })

      await refreshSession(request)
      const [, message] = request.logger.info.mock.calls.at(-1)
      return message
    }

    test('flags a case-only difference as case-only, not a real change', async () => {
      // The most likely mundane cause: the same GUID upper-cased by a different
      // claim pipeline. verify-role.js compares relationship ids case-
      // sensitively, so this alone was enough to end a session pre-BMD-936.
      const message = await driftFor('REL-1')

      expect(message).toContain(
        'currentRelationshipId=scalar(differs:case-only)'
      )
    })

    test('flags brace/whitespace dressing as format-only', async () => {
      const message = await driftFor('{rel-1}')

      expect(message).toContain(
        'currentRelationshipId=scalar(differs:format-only)'
      )
    })

    test('flags another relationship the user holds as known-relationship', async () => {
      const message = await driftFor('rel-2', {
        roles: ['rel-1:bng completer:3', 'rel-2:bng completer:3'],
        relationships: [
          'rel-1:org-1:Acme Ltd:0:Employee:1',
          'rel-2:org-2:Globex:0:Employee:1'
        ]
      })

      expect(message).toContain(
        'currentRelationshipId=scalar(differs:known-relationship)'
      )
    })

    test('flags an id the user holds no record of as unknown', async () => {
      // The single-relationship case seen in the deployed logs - and the only
      // classification that points at Defra ID rather than at our comparison.
      const message = await driftFor('eb18c414-5349-f111-bec6-000d3a495d27')

      expect(message).toContain('currentRelationshipId=scalar(differs:unknown)')
    })

    test('flags a claim that was absent at sign-in as previously-absent', async () => {
      const message = await driftFor('rel-1', { currentRelationshipId: '' })

      expect(message).toContain(
        'currentRelationshipId=scalar(differs:previously-absent)'
      )
    })

    test('still logs no drift marker when the value is unchanged', async () => {
      const message = await driftFor('rel-1')

      expect(message).toContain('currentRelationshipId=scalar]')
      expect(message).not.toContain('currentRelationshipId=scalar(')
    })

    test('never logs the claim values themselves', async () => {
      const message = await driftFor('eb18c414-5349-f111-bec6-000d3a495d27')

      expect(message).not.toContain('eb18c414')
      expect(message).not.toContain('Acme')
      expect(message).not.toContain('rel-1')
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

  test('logs PII-safe OAuth error detail and a category when the grant is rejected', async () => {
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
        category: 'refresh-token-rejected',
        likelyCause: expect.stringContaining('Refresh token expired'),
        detail: expect.stringContaining('oauthError=invalid_grant')
      }),
      'OIDC: silent token refresh failed [category=refresh-token-rejected]'
    )
  })

  describe('when the grant returns no id_token', () => {
    // The id_token IS the session: it carries the `exp` the expiry check reads
    // and it is the bearer credential sent to the backend. Without one there is
    // nothing to renew with, so the session ends and the user gets the friendly
    // "Sign in again" page rather than a half-written session.
    const tokensWithoutIdToken = {
      id_token: undefined,
      refresh_token: 'refresh-2',
      claims: () => undefined
    }

    function signedInRequest() {
      return makeRequest({
        idToken: 'old-id',
        refreshToken: 'refresh-1',
        user: { sub: 'u1', exp: 1234567890, roles: ['rel-1:bng completer:3'] }
      })
    }

    test('returns null so the caller ends the session', async () => {
      const request = signedInRequest()
      vi.mocked(refreshTokenGrant).mockResolvedValue(tokensWithoutIdToken)

      expect(await refreshSession(request)).toBeNull()
    })

    test('leaves the stored session untouched rather than writing a broken one', async () => {
      const request = signedInRequest()
      vi.mocked(refreshTokenGrant).mockResolvedValue(tokensWithoutIdToken)

      await refreshSession(request)

      expect(request.yar.set).not.toHaveBeenCalled()
      expect(request._store.auth.idToken).toBe('old-id')
    })

    test('logs it as a failure with its own category, not as a success', async () => {
      const request = signedInRequest()
      vi.mocked(refreshTokenGrant).mockResolvedValue(tokensWithoutIdToken)

      await refreshSession(request)

      expect(request.logger.info).not.toHaveBeenCalled()
      expect(request.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', category: 'no-id-token' }),
        'OIDC: silent token refresh failed [category=no-id-token]'
      )
    })
  })
})

describe('classifyRefreshError', () => {
  test('maps invalid_grant to refresh-token-rejected', () => {
    expect(classifyRefreshError({ error: 'invalid_grant' })).toBe(
      REFRESH_ERROR.tokenRejected
    )
  })

  test('maps invalid_client and unauthorized_client to client-auth-failed', () => {
    expect(classifyRefreshError({ error: 'invalid_client' })).toBe(
      REFRESH_ERROR.clientAuthFailed
    )
    expect(classifyRefreshError({ error: 'unauthorized_client' })).toBe(
      REFRESH_ERROR.clientAuthFailed
    )
  })

  test('maps invalid_scope to scope-rejected', () => {
    expect(classifyRefreshError({ error: 'invalid_scope' })).toBe(
      REFRESH_ERROR.scopeRejected
    )
  })

  test('maps an unrecognised OAuth error to the generic oauth-error', () => {
    expect(classifyRefreshError({ error: 'temporarily_unavailable' })).toBe(
      REFRESH_ERROR.oauthError
    )
  })

  test('maps a network error code to idp-unreachable', () => {
    expect(classifyRefreshError({ code: 'ENOTFOUND' })).toBe(
      REFRESH_ERROR.idpUnreachable
    )
    expect(classifyRefreshError({ cause: { code: 'ECONNREFUSED' } })).toBe(
      REFRESH_ERROR.idpUnreachable
    )
  })

  test('falls back to the unknown category otherwise', () => {
    expect(classifyRefreshError(new Error('boom'))).toBe(REFRESH_ERROR.unknown)
  })
})
