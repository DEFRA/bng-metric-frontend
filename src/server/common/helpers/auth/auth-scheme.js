import Boom from '@hapi/boom'

import { refreshSession } from './refresh-session.js'
import {
  SESSION_EXPIRED_PATH,
  expireSession,
  isSessionExpired
} from './session-expiry.js'

const FORBIDDEN_PATH = '/auth/forbidden'

// hapi runs authenticate for 'try'/'optional' routes too (the home page uses
// 'try' so it can render a signed-out state). Those routes must never be
// redirected away — throwing lets hapi continue unauthenticated instead.
function isAuthRequired(request) {
  return (request.route?.settings?.auth?.mode ?? 'required') === 'required'
}

function unauthenticated(request, h, redirectPath, reason) {
  if (isAuthRequired(request)) {
    return h.redirect(redirectPath).takeover()
  }
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
        request.logger.info(
          { hasSession: Boolean(session), path: request.path },
          'Auth: request has no authenticated session, redirecting to /auth/forbidden'
        )
        return unauthenticated(
          request,
          h,
          FORBIDDEN_PATH,
          'No authenticated session'
        )
      }

      if (!isSessionExpired(session)) {
        return h.authenticated({ credentials: user })
      }

      // The tokens have expired even though the yar session is still alive
      // (the session TTL is longer than the token lifetime). Renew silently;
      // only when the IdP refuses is the session really over. (BMD-829)
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
