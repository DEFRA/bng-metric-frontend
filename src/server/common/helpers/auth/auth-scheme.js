import Boom from '@hapi/boom'

import { refreshSession } from './refresh-session.js'
import {
  SESSION_EXPIRED_PATH,
  expireSession,
  isSessionExpired,
  wasSessionEnded
} from './session-expiry.js'

const FORBIDDEN_PATH = '/auth/forbidden'

// hapi runs authenticate for 'try'/'optional' routes too (the home page uses
// 'try' so it can render a signed-out state). Those routes must never be
// redirected away — throwing lets hapi continue unauthenticated instead.
function isAuthRequired(request) {
  return (request.route?.settings?.auth?.mode ?? 'required') === 'required'
}

// Logs the outcome it actually takes: a required-auth route redirects, while a
// 'try'/'optional' route continues unauthenticated (e.g. the home page
// rendering its signed-out state) — so debug trails never claim a redirect
// that didn't happen.
function unauthenticated(request, h, redirectPath, reason, logContext = {}) {
  if (isAuthRequired(request)) {
    request.logger.info(
      { ...logContext, path: request.path },
      `Auth: ${reason}, redirecting to ${redirectPath}`
    )
    return h.redirect(redirectPath).takeover()
  }
  request.logger.info(
    { ...logContext, path: request.path },
    `Auth: ${reason}, continuing unauthenticated (try-mode route)`
  )
  throw Boom.unauthorized(reason, 'session')
}

function sessionScheme() {
  return {
    async authenticate(request, h) {
      const session = request.yar?.get('auth')
      const user = session?.user

      request.logger.debug(
        {
          hasYar: Boolean(request.yar),
          hasSession: Boolean(session),
          hasUser: Boolean(user)
        },
        'Auth scheme: checking session'
      )

      if (!user) {
        // The session store is empty. That covers two very different users
        // that look identical here: one whose expired session we already
        // ended (a 'try'-mode page such as the home page clears it silently,
        // leaving a `sessionEnded` breadcrumb), and one who never signed in.
        // Send the former to the "Sign in again" page and leave the latter on
        // the plain forbidden page. (BMD-829)
        const ended = wasSessionEnded(request)
        return unauthenticated(
          request,
          h,
          ended ? SESSION_EXPIRED_PATH : FORBIDDEN_PATH,
          // Distinct reason from the in-scheme expiry above, so CDP logs show
          // the two-page flow clearly: a 'try'-mode page ends the session,
          // then this fires on the next protected click. (BMD-829)
          ended ? 'Session already ended' : 'No authenticated session',
          { hasSession: Boolean(session) }
        )
      }

      if (!isSessionExpired(session)) {
        return h.authenticated({ credentials: user })
      }

      // The tokens have expired even though the yar session is still alive
      // (the session TTL is longer than the token lifetime). Renew silently;
      // only when the IdP refuses is the session really over. (BMD-829)
      request.logger.info(
        {
          sub: user.sub,
          path: request.path,
          mode: request.route?.settings?.auth?.mode ?? 'required'
        },
        'Auth: session token expired, attempting silent refresh'
      )
      const newIdToken = await refreshSession(request)
      if (newIdToken) {
        const refreshedUser = request.yar.get('auth')?.user ?? user
        return h.authenticated({ credentials: refreshedUser })
      }

      request.logger.info(
        { sub: user.sub, path: request.path },
        'Auth: session tokens expired and silent refresh failed, ending session'
      )
      expireSession(request)
      return unauthenticated(
        request,
        h,
        SESSION_EXPIRED_PATH,
        'Session expired'
      )
    }
  }
}

export const authScheme = {
  plugin: {
    name: 'auth-scheme',
    register(server) {
      server.auth.scheme('session', sessionScheme)
      server.auth.strategy('session', 'session')

      server.ext('onPreResponse', (request, h) => {
        // Set no-store header on authenticated responses, to prevent browser caching
        // This ensures logged-out users do not see cached pages from when they were logged in
        if (request.auth.isAuthenticated) {
          const response = request.response
          if (!response.isBoom) {
            response.header('Cache-Control', 'no-store')
          }
        }
        return h.continue
      })
    }
  }
}
