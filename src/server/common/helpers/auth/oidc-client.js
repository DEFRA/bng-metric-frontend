import { allowInsecureRequests, discovery } from 'openid-client'

import { config } from '../../../../config/config.js'

let oidcConfigPromise

export function getOidcConfig() {
  if (!oidcConfigPromise) {
    const discoveryUrl = new URL(config.get('oidc.discoveryUrl'))
    const clientId = config.get('oidc.clientId')
    const clientSecret = config.get('oidc.clientSecret')

    const options =
      discoveryUrl.protocol === 'http:'
        ? { execute: [allowInsecureRequests] }
        : undefined

    oidcConfigPromise = discovery(
      discoveryUrl,
      clientId,
      clientSecret,
      undefined,
      options
    ).catch((error) => {
      oidcConfigPromise = undefined
      throw error
    })
  }

  return oidcConfigPromise
}

export function resetOidcConfig() {
  oidcConfigPromise = undefined
}
