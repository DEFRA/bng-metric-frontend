import crumb from '@hapi/crumb'

import { config } from '../../../config/config.js'

/**
 * Global CSRF protection via @hapi/crumb.
 *
 * - `restful: false` — validates unsafe requests by matching a `crumb` field
 *   in the request payload against the `crumb` cookie. JS fetch clients must
 *   include `crumb` in their JSON body (read from the <meta name="csrf-token">
 *   tag). The `X-CSRF-Token` header is only honoured in `restful: true` mode,
 *   which we would switch to if/when the app becomes API-first.
 * - `addToViewContext: true` exposes `crumb` to every `h.view()` render so the
 *   form macro and the <meta> tag can read it without each handler passing it.
 * - Per-route opt-out: `options: { plugins: { crumb: false } }`.
 * - Cookie flags mirror the yar session cookie so both travel together.
 */
export const csrf = {
  plugin: crumb,
  options: {
    key: 'crumb',
    cookieOptions: {
      isSecure: config.get('session.cookie.secure'),
      isHttpOnly: true,
      isSameSite: 'Lax',
      path: '/'
    },
    restful: false,
    addToViewContext: true
  }
}
