/**
 * Build the Authorization header for a backend call from the id_token stored in
 * the user's yar session. Returns an empty object when there is no token so the
 * spread is always safe.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {{ Authorization: string } | {}}
 */
export function authHeaders(request) {
  const idToken = request.yar?.get('auth')?.idToken
  return idToken ? { Authorization: `Bearer ${idToken}` } : {}
}
