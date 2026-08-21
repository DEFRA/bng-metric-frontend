/* global DOMParser */

/**
 * Render a page via a real server injection and parse it into a DOM
 * document, for use with accessibility checks (see `axe-helper.js`).
 * @param {object} params
 * @param {string} params.requestUrl
 * @param {import('@hapi/hapi').Server} params.server
 * @param {object} [params.auth] hapi `auth` credentials override, as used in server.inject
 * @param {object} [params.headers]
 * @param {number} [params.expectedStatusCode] status the response must have, so a
 * redirect or error page can't silently pass as the page under test
 */
export async function loadPage({
  requestUrl,
  server,
  auth,
  headers = {},
  expectedStatusCode = 200
}) {
  const response = await server.inject({
    method: 'GET',
    url: requestUrl,
    auth,
    headers
  })
  expect(response.statusCode).toBe(expectedStatusCode)
  const document = new DOMParser().parseFromString(response.result, 'text/html')
  return { document, response }
}
