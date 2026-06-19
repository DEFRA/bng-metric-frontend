import { authHeaders } from './auth-headers.js'

function makeRequest(authValue) {
  return { yar: { get: vi.fn().mockReturnValue(authValue) } }
}

describe('authHeaders', () => {
  test('returns a Bearer header when an id_token is in the session', () => {
    expect(authHeaders(makeRequest({ idToken: 'abc.def.ghi' }))).toEqual({
      Authorization: 'Bearer abc.def.ghi'
    })
  })

  test('returns an empty object when there is no auth session', () => {
    expect(authHeaders(makeRequest(undefined))).toEqual({})
  })

  test('returns an empty object when the session has no id_token', () => {
    expect(authHeaders(makeRequest({ user: {} }))).toEqual({})
  })

  test('does not throw when yar is missing', () => {
    expect(authHeaders({})).toEqual({})
  })
})
