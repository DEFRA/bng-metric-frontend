// Editing the reference of a Retained post-intervention habitat (BMD-1180).
//
// A Retained area habitat, hedgerow or watercourse is its baseline parcel
// carried forward, so its reference is the one thing on the page the user can
// change. The page stays the read-only details page with a reference input at
// the top of the first section and Save / Cancel below; the rules and the
// error wording are the baseline page's (BMD-1061, common/helpers/habitat-ref.js).
//
// The backend makes the rename to the baseline parcel the habitat is joined to
// and carries it onto every post-intervention row joined to that parcel, so
// the two stay linked.

import Boom from '@hapi/boom'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { backendRequest } from '../common/helpers/auth/backend-request.js'
import {
  HABITAT_REF_ERROR,
  MAX_HABITAT_REF_LENGTH
} from '../common/helpers/habitat-ref.js'
import { RETENTION_RETAINED } from './retention.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

export const DETAILS_ROUTE = '/post-intervention-habitat-details'

// The input's id, which the error summary links to.
export const REF_FIELD_ID = 'ref'

// The page heading names the habitat by its saved reference, as the baseline
// details pages do (BMD-1061).
const HEADING_PREFIX_BY_TYPE = new Map([
  ['habitat', 'Habitat'],
  ['hedgerow', 'Hedgerow'],
  ['watercourse', 'Watercourse']
])

/**
 * Whether the page for this feature carries the reference input: Retained area
 * habitats, hedgerows and watercourses only.
 *
 * @param {string} type feature type from the PI feature endpoint
 * @param {string|null} retentionCategory normalised retention category
 * @returns {boolean}
 */
export function isRefEditable(type, retentionCategory) {
  return (
    retentionCategory === RETENTION_RETAINED && HEADING_PREFIX_BY_TYPE.has(type)
  )
}

/**
 * The view-model fields that turn a retained details page into the reference
 * form. `submittedRef` is set when a save was refused: the input shows what was
 * typed, and the page carries the error.
 *
 * @param {{ type: string, feature: object, projectId: string, featureId: string, returnUrl?: string, cancelHref: string, submittedRef?: string }} params
 * @returns {object}
 */
export function retainedRefEditFields({
  type,
  feature,
  projectId,
  featureId,
  returnUrl,
  cancelHref,
  submittedRef
}) {
  const refused = submittedRef !== undefined
  const heading =
    `${HEADING_PREFIX_BY_TYPE.get(type)} ${feature.ref ?? ''}`.trimEnd()
  return {
    heading,
    pageTitle: refused ? `Error: ${heading}` : heading,
    errors: refused
      ? [{ text: HABITAT_REF_ERROR.summary, href: `#${REF_FIELD_ID}` }]
      : [],
    refForm: {
      action: DETAILS_ROUTE,
      projectId,
      featureId,
      returnUrl: returnUrl ?? '',
      fieldId: REF_FIELD_ID,
      value: refused ? submittedRef : (feature.ref ?? ''),
      error: refused ? { text: HABITAT_REF_ERROR.inline } : undefined,
      maxLength: MAX_HABITAT_REF_LENGTH,
      cancelHref
    }
  }
}

/**
 * Save the reference. Resolves to the backend's `{ type, feature }`.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {{ projectId: string, featureId: string, ref: string }} params
 *   `ref` has passed isValidHabitatRef; it is sent trimmed
 * @returns {Promise<{ type: string, feature: object }>}
 */
export async function saveRetainedRef(request, { projectId, featureId, ref }) {
  try {
    const { payload } = await backendRequest(
      request,
      'put',
      `${backendUrl}/projects/${projectId}/post-intervention/features/${featureId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({ ref: ref.trim() })
      }
    )
    return payload
  } catch (err) {
    // An expired session is handled by catchAll (a redirect to sign in again).
    if (err?.data?.sessionExpired) {
      throw err
    }
    const statusCode = err?.data?.res?.statusCode ?? err?.output?.statusCode
    if (statusCode === statusCodes.conflict) {
      throw Boom.conflict('Another user is editing this project')
    }
    if (statusCode === statusCodes.notFound) {
      throw Boom.notFound(`Feature ${featureId} not found`)
    }
    if (statusCode === statusCodes.badRequest) {
      throw Boom.badRequest("This habitat's reference cannot be edited")
    }
    throw Boom.badGateway('Failed to save habitat')
  }
}
