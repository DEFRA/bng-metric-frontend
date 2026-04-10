import Boom from '@hapi/boom'

function sessionScheme() {
  return {
    authenticate(request, h) {
      const session = request.yar?.get('auth')
      const user = session?.user

      if (!user) {
        return h.unauthenticated(Boom.unauthorized(null, 'session'))
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
    }
  }
}
