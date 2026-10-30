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

import Joi from 'joi'

import { config } from '../../config/config.js'
import { backendRequest } from '../common/helpers/auth/backend-request.js'
import { backendSaveError } from '../common/helpers/backend-save-error.js'
import {
  habitatRefFormFields,
  isRefInUseError
} from '../common/helpers/habitat-ref.js'
import { RETENTION_RETAINED } from './retention.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

export const DETAILS_ROUTE = '/post-intervention-habitat-details'

// What the reference form posts.
export const retainedRefPayloadSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  featureId: Joi.string().uuid().required(),
  habitatRef: Joi.string().allow('').required(),
  returnUrl: Joi.string().allow('').optional(),
  crumb: Joi.string().optional()
})

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
 * form: the heading, the shared reference input and error summary
 * (habitatRefFormFields), and what the form posts. `refusal` and
 * `submittedRef` are set when a save was refused.
 *
 * @param {{ type: string, feature: object, projectId: string, featureId: string, returnUrl?: string, cancelHref: string, submittedRef?: string, refusal?: { summary: string, inline: string } }} params
 * @returns {object}
 */
export function retainedRefEditFields({
  type,
  feature,
  projectId,
  featureId,
  returnUrl,
  cancelHref,
  submittedRef,
  refusal
}) {
  const heading =
    `${HEADING_PREFIX_BY_TYPE.get(type)} ${feature.ref ?? ''}`.trimEnd()
  return {
    heading,
    ...habitatRefFormFields({
      heading,
      savedRef: feature.ref,
      submittedRef,
      refusal
    }),
    refForm: {
      action: DETAILS_ROUTE,
      projectId,
      featureId,
      returnUrl: returnUrl ?? '',
      cancelHref
    }
  }
}

/**
 * Save the reference. Resolves to the backend's `{ type, feature }`, or to
 * `{ refInUse: true }` when the backend refuses a reference another habitat
 * already carries. Any other failure throws (backendSaveError).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {{ projectId: string, featureId: string, ref: string }} params
 *   `ref` has passed isValidHabitatRef; it is sent trimmed
 * @returns {Promise<{ type: string, feature: object } | { refInUse: true }>}
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
    if (isRefInUseError(err)) {
      return { refInUse: true }
    }
    throw backendSaveError(err, featureId)
  }
}
