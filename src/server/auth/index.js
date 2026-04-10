import {
  callbackController,
  forbiddenController,
  loginController,
  logoutController,
  signedOutController
} from './controller.js'

export const auth = {
  plugin: {
    name: 'auth',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/auth/login',
          ...loginController
        },
        {
          method: 'GET',
          path: '/auth/callback',
          ...callbackController
        },
        {
          method: 'GET',
          path: '/auth/logout',
          ...logoutController
        },
        {
          method: 'GET',
          path: '/auth/signed-out',
          ...signedOutController
        },
        {
          method: 'GET',
          path: '/auth/forbidden',
          ...forbiddenController
        }
      ])
    }
  }
}
