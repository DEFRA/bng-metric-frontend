function sessionScheme() {
  return {
    authenticate(request, h) {
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
        return h.redirect('/auth/forbidden').takeover()
      }

      return h.authenticated({ credentials: user })
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
