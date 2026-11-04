import Boom from '@hapi/boom'

import {
  backendFailureKind,
  describeBackendFailure
} from './backend-failure.js'

const TIMING = { elapsedMs: 1234.6, timeoutMs: 25000 }

// The shapes @hapi/wreck rejects with (lib/index.js): a response error carries
// the response; its own timeout and connection failures are bare Booms.
function responseError(statusCode, { headers = {}, payload } = {}) {
  return new Boom.Boom(`Response Error: ${statusCode}`, {
    statusCode,
    data: { isResponseError: true, headers, res: { statusCode }, payload }
  })
}

// A response wreck could not read: it rethrows the read error with the
// response attached as `data.res` (_shortcut). A body that will not parse as
// JSON is a 502 of wreck's own, with the raw body kept (tryParseBuffer).
function unparseableResponse(statusCode, headers, body) {
  const error = Boom.badGateway(
    'Unexpected token \'<\', "<html>" is not valid JSON',
    {
      payload: Buffer.from(body)
    }
  )
  error.data.res = { statusCode, headers }
  return error
}

function connectionError(code) {
  const socketError = new Error(`connect ${code} 10.0.0.1:443`)
  socketError.code = code
  return Boom.badGateway('Client request error', socketError)
}

describe('#backendFailureKind', () => {
  test('a response from the backend or a proxy', () => {
    expect(backendFailureKind(responseError(502))).toBe('response')
  })

  test('a response whose body could not be read', () => {
    expect(
      backendFailureKind(
        unparseableResponse(
          502,
          { 'content-type': 'application/json' },
          '<html>'
        )
      )
    ).toBe('unreadable')
  })

  test("wreck's own timeout, although it wears a 504", () => {
    expect(
      backendFailureKind(Boom.gatewayTimeout('Client request timeout'))
    ).toBe('timeout')
  })

  test('a failed connection, although it wears a 502', () => {
    expect(backendFailureKind(connectionError('ECONNRESET'))).toBe('connection')
  })

  test('anything else', () => {
    expect(backendFailureKind(new Error('boom'))).toBe('other')
    expect(backendFailureKind(undefined)).toBe('other')
  })
})

describe('#describeBackendFailure', () => {
  test('says what answered, with the start of a non-JSON body as text', () => {
    const page = Buffer.from(
      '<html>\n<head><title>502 Bad Gateway</title></head>\n<body>nginx</body></html>'
    )
    const error = responseError(502, {
      headers: { 'content-type': 'text/html', server: 'nginx' },
      payload: page
    })

    expect(describeBackendFailure(error, TIMING)).toBe(
      'failure: response, elapsedMs: 1235, timeoutMs: 25000, responseStatusCode: 502, contentType: text/html, server: nginx, body: <html> <head><title>502 Bad Gateway</title></head> <body>nginx</body></html>'
    )
  })

  test("quotes the backend's own JSON body", () => {
    const error = responseError(500, {
      headers: { 'content-type': 'application/json' },
      payload: { valid: false, errors: [{ code: 'VALIDATION_FAILED' }] }
    })

    expect(describeBackendFailure(error, TIMING)).toContain(
      'body: {"valid":false,"errors":[{"code":"VALIDATION_FAILED"}]}'
    )
  })

  test('quotes a long JSON body whole, so no error code is lost', () => {
    const errors = Array.from({ length: 40 }, (_, i) => ({ code: `CODE_${i}` }))
    const error = responseError(422, { payload: { valid: false, errors } })

    expect(describeBackendFailure(error, TIMING)).toContain(
      `body: ${JSON.stringify({ valid: false, errors })}`
    )
  })

  test('caps a long raw body', () => {
    const error = responseError(502, { payload: Buffer.from('x'.repeat(5000)) })

    expect(describeBackendFailure(error, TIMING)).toMatch(/body: x{300}$/)
  })

  test('says when a response had no headers or body', () => {
    expect(describeBackendFailure(responseError(503), TIMING)).toContain(
      'contentType: none, server: none, body: none'
    )
  })

  test('says what answered when its body would not parse, not just the 502 wreck gives it', () => {
    const error = unparseableResponse(
      502,
      { 'content-type': 'application/json', server: 'envoy' },
      '<html><title>502 Bad Gateway</title></html>'
    )

    expect(describeBackendFailure(error, TIMING)).toBe(
      'failure: unreadable, elapsedMs: 1235, timeoutMs: 25000, responseStatusCode: 502, contentType: application/json, server: envoy, body: <html><title>502 Bad Gateway</title></html>'
    )
  })

  test('says what answered when its body stopped short', () => {
    const error = Boom.internal('Payload stream closed prematurely')
    error.data = { res: { statusCode: 200, headers: { server: 'envoy' } } }

    expect(describeBackendFailure(error, TIMING)).toBe(
      'failure: unreadable, elapsedMs: 1235, timeoutMs: 25000, responseStatusCode: 200, contentType: none, server: envoy, body: none'
    )
  })

  test('gives the socket error code for a failed connection', () => {
    expect(
      describeBackendFailure(connectionError('ECONNREFUSED'), TIMING)
    ).toBe(
      'failure: connection, elapsedMs: 1235, timeoutMs: 25000, errorCode: ECONNREFUSED'
    )
  })

  test('gives the timing for a timeout, which is the whole story', () => {
    expect(
      describeBackendFailure(Boom.gatewayTimeout('Client request timeout'), {
        elapsedMs: 25003,
        timeoutMs: 25000
      })
    ).toBe('failure: timeout, elapsedMs: 25003, timeoutMs: 25000')
  })

  test('names an error of any other kind', () => {
    expect(describeBackendFailure(new TypeError('nope'), TIMING)).toBe(
      'failure: other, elapsedMs: 1235, timeoutMs: 25000, errorName: TypeError'
    )
  })
})
