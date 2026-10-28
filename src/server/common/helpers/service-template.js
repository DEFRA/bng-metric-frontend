import { config } from '../../../config/config.js'

/**
 * The template name the backend records on a document uploaded in the BNG
 * Service template (BMD-1082). A legacy document records none.
 */
const SERVICE_TEMPLATE_NAME = 'bng-service'

/**
 * Whether the service-template flag is on. It decides copy only, such as the
 * upload guidance and error text: what a project's data looks like follows
 * the template recorded on its documents (isServiceTemplateDocument).
 *
 * @returns {boolean}
 */
function isServiceTemplateEnabled() {
  return config.get('serviceTemplate.enabled')
}

/**
 * Whether a project document (`baseline` or `postIntervention`) was uploaded
 * in the BNG Service template, whatever the flag says now.
 *
 * @param {{ template?: { name?: string } } | null | undefined} document
 * @returns {boolean}
 */
function isServiceTemplateDocument(document) {
  return document?.template?.name === SERVICE_TEMPLATE_NAME
}

export {
  SERVICE_TEMPLATE_NAME,
  isServiceTemplateDocument,
  isServiceTemplateEnabled
}
