/**
 * Primes a crumb cookie from a safe GET and returns the pieces needed to
 * pass CSRF checks in tests. Use it before POST/PUT/PATCH/DELETE injects:
 *
 *   const { token, cookie } = await primeCrumb(server)
 *   await server.inject({
 *     method: 'POST',
 *     url: '/foo',
 *     payload: { ..., crumb: token },
 *     headers: { cookie },
 *     auth: ...
 *   })
 */
export async function primeCrumb(server, url = '/health') {
  const res = await server.inject({ method: 'GET', url })
  const setCookie = res.headers['set-cookie']
  const cookies = Array.isArray(setCookie)
    ? setCookie
    : [setCookie].filter(Boolean)
  const crumbCookie = cookies.find((c) => c.startsWith('crumb='))
  if (!crumbCookie) {
    throw new Error(
      `No crumb cookie set on GET ${url} — is @hapi/crumb registered?`
    )
  }
  const token = crumbCookie.split(';')[0].split('=')[1]
  return { token, cookie: `crumb=${token}` }
}
