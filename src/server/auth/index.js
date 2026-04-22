import {
  callbackController,
  forbiddenController,
  loginController,
  logoutController,
  signedOutController
} from './controller.js'

/**
 * @openapi
 * /auth/login:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Initiate OIDC login
 *     responses:
 *       302:
 *         description: Redirects to the identity provider
 * /auth/callback:
 *   get:
 *     tags:
 *       - Auth
 *     summary: OIDC callback
 *     responses:
 *       302:
 *         description: Handles the identity provider callback and redirects to the app
 * /auth/logout:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Log out
 *     responses:
 *       302:
 *         description: Ends the session and redirects to the identity provider logout
 * /auth/signed-out:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Signed-out confirmation
 *     responses:
 *       200:
 *         description: Renders the signed-out page
 * /auth/forbidden:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Forbidden
 *     responses:
 *       403:
 *         description: Renders the forbidden page
 */
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
