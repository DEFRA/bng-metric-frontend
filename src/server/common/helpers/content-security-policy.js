import Blankie from 'blankie'
import { config } from '../../../config/config.js'

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const cdpUploaderUrl = config.get('cdpUploader.url')

const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    // Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
    // https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy
    defaultSrc: ['self'],
    fontSrc: ['self', 'data:'],
    connectSrc: ['self', 'wss', 'data:'],
    mediaSrc: ['self'],
    // maplibre-gl (loaded via @defra/interactive-map for BMD-546) injects
    // inline styles for map controls and creates its tile-parsing worker
    // from a blob: URL. Both are required for the OS Maps tile renderer.
    styleSrc: ['self', "'unsafe-inline'"],
    workerSrc: ['self', 'blob:'],
    scriptSrc: [
      'self',
      "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"
    ],
    imgSrc: ['self', 'data:', 'blob:'],
    frameSrc: ['self', 'data:'],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    formAction: ['self', ...(cdpUploaderUrl ? [cdpUploaderUrl] : [])],
    manifestSrc: ['self'],
    generateNonces: false
  }
}

export { contentSecurityPolicy }
