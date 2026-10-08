import Blankie from 'blankie'
import { createHash } from 'node:crypto'
import { config } from '../../../config/config.js'
import {
  googleAnalyticsConsentScript,
  googleTagManagerScript,
  isGoogleTagManagerEnabled
} from './google-tag-manager.js'

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const cdpUploaderUrl = config.get('cdpUploader.url')
const gtmEnabled = isGoogleTagManagerEnabled()
const gtmOrigin = 'https://www.googletagmanager.com'
const analyticsOrigins = gtmEnabled
  ? [gtmOrigin, 'https://*.google-analytics.com']
  : []
const hashSource = (source) =>
  `'sha256-${createHash('sha256').update(source).digest('base64')}'`

const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    // Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
    // https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy
    defaultSrc: ['self'],
    fontSrc: ['self', 'data:'],
    connectSrc: [
      'self',
      'wss',
      'data:',
      ...analyticsOrigins,
      ...(gtmEnabled ? ['https://*.google.com'] : [])
    ],
    mediaSrc: ['self'],
    // Allow only the supplied noscript iframe's hiding style, not arbitrary
    // inline styles. The hash requires unsafe-hashes for style attributes.
    styleSrc: [
      'self',
      ...(gtmEnabled
        ? ["'unsafe-hashes'", hashSource('display:none;visibility:hidden')]
        : [])
    ],
    scriptSrc: [
      'self',
      "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='",
      ...(gtmEnabled
        ? [
            gtmOrigin,
            hashSource(googleAnalyticsConsentScript),
            hashSource(googleTagManagerScript)
          ]
        : [])
    ],
    imgSrc: ['self', 'data:', ...analyticsOrigins],
    frameSrc: ['self', 'data:', ...(gtmEnabled ? [gtmOrigin] : [])],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    formAction: ['self', ...(cdpUploaderUrl ? [cdpUploaderUrl] : [])],
    manifestSrc: ['self'],
    generateNonces: false
  }
}

export { contentSecurityPolicy }
