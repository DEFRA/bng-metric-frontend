import yar from '@hapi/yar'

import { config } from '../../../../config/config.js'

const MS_PER_SECOND = 1000

const sessionConfig = config.get('session')

// The configured session lifetime is authored in seconds (SESSION_TTL_SECONDS);
// yar wants milliseconds. Convert once here and feed the SAME value to the
// server-side cache expiry and the cookie ttl so a deployed environment can set
// one env var and have it respected across the board.
const sessionTtlMs = sessionConfig.ttlSeconds * MS_PER_SECOND

/**
 * Set options.maxCookieSize to 0 to always use server-side storage
 */
export const sessionCache = {
  plugin: yar,
  options: {
    name: sessionConfig.cache.name,
    cache: {
      cache: sessionConfig.cache.name,
      expiresIn: sessionTtlMs
    },
    storeBlank: false,
    errorOnCacheNotReady: true,
    cookieOptions: {
      password: sessionConfig.cookie.password,
      ttl: sessionTtlMs,
      isSecure: config.get('session.cookie.secure'),
      // SameSite=Lax: the browser sends this session cookie only when the
      // user arrives via normal navigation (typed URL, clicked link).
      // Requests triggered in the background from another site — hidden
      // auto-posting forms, <img> pings, cross-origin fetches — arrive
      // without the cookie, so they cannot ride on the victim's logged-in
      // session. Without this, a page on evil.com could fire a request at
      // us that the browser would happily authenticate as the user. This
      // is defence-in-depth alongside crumb (the CSRF token check).
      // Refs:
      //   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
      //   https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
      isSameSite: 'Lax',
      clearInvalid: true
    }
  }
}
