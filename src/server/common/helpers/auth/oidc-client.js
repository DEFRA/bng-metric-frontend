import { allowInsecureRequests, discovery } from 'openid-client'

import { config } from '../../../../config/config.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

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

    logger.info(
      {
        discoveryUrl: discoveryUrl.href,
        clientId,
        allowInsecure: Boolean(options)
      },
      'OIDC discovery: fetching provider configuration'
    )

    oidcConfigPromise = discovery(
      discoveryUrl,
      clientId,
      clientSecret,
      undefined,
      options
    )
      .then((oidcConfig) => {
        logger.info(
          { discoveryUrl: discoveryUrl.href },
          'OIDC discovery: provider configuration loaded'
        )
        return oidcConfig
      })
      .catch((error) => {
        oidcConfigPromise = undefined
        logger.error(error, `OIDC discovery failed for ${discoveryUrl.href}`)
        throw error
      })
  }

  return oidcConfigPromise
}

export function resetOidcConfig() {
  oidcConfigPromise = undefined
}
