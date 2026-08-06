/* global DOMParser */

/**
 * Render a page via a real server injection and parse it into a DOM
 * document, for use with accessibility checks (see `axe-helper.js`).
 * @param {object} params
 * @param {string} params.requestUrl
 * @param {import('@hapi/hapi').Server} params.server
 * @param {object} [params.auth] hapi `auth` credentials override, as used in server.inject
 * @param {object} [params.headers]
 */
export async function loadPage({ requestUrl, server, auth, headers = {} }) {
  const response = await server.inject({
    method: 'GET',
    url: requestUrl,
    auth,
    headers
  })
  const document = new DOMParser().parseFromString(response.result, 'text/html')
  return { document, response }
}
