// Editing the reference of a Retained post-intervention habitat (BMD-1180).
//
// A Retained area habitat, tree, hedgerow or watercourse is its baseline parcel
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
import {
  backendSaveError,
  backendStatusOf
} from '../common/helpers/backend-save-error.js'
import { statusCodes } from '../common/constants.js'
import {
  HABITAT_REF_TOO_LONG_ERROR,
  habitatRefFormFields
} from '../common/helpers/habitat-ref.js'
import {
  isStoredValueRefusal,
  storedValueRefusal
} from '../common/helpers/stored-value-refusal.js'
import { RETENTION_RETAINED } from './retention.js'
import { loadCreatedTreeReference } from './created-edit-reference.js'

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

/** The feature types whose Retained rows have an editable reference. */
const REF_EDITABLE_TYPES = new Set([
  'habitat',
  'tree',
  'hedgerow',
  'watercourse'
])

// The page heading is "Habitat <saved reference>" for every type, trees,
// hedgerows and watercourses included, as the three designs show (PO, 3 Nov).
const HEADING_PREFIX = 'Habitat'

/**
 * Whether the page for this feature carries the reference input: Retained area
 * habitats, trees, hedgerows and watercourses only.
 *
 * @param {string} type feature type from the PI feature endpoint
 * @param {string|null} retentionCategory normalised retention category
 * @returns {boolean}
 */
export function isRefEditable(type, retentionCategory) {
  return (
    retentionCategory === RETENTION_RETAINED && REF_EDITABLE_TYPES.has(type)
  )
}

/**
 * Whether the backend can rename this feature now. A Retained tree is renamed
 * only by a backend that also serves the tree creation reference, so until
 * that is deployed the tree's page stays read-only, as a Created tree's does.
 * Otherwise a rename would come back as the bare 400 the page reads as a
 * refused reference, and blame a valid one.
 *
 * The page itself needs nothing from the reference, so on showing it any
 * failure to load it leaves the page read-only, logged, rather than an error
 * page. With `strict`, as on a save, only a 404 means the backend cannot
 * rename trees; any other failure is thrown.
 *
 * @param {string} type feature type from the PI feature endpoint
 * @param {string|null} retentionCategory normalised retention category
 * @param {{ strict?: boolean, logger?: { warn: Function } }} [options]
 * @returns {Promise<boolean>}
 */
export async function canRenameNow(
  type,
  retentionCategory,
  { strict = false, logger } = {}
) {
  if (!isRefEditable(type, retentionCategory)) {
    return false
  }
  if (type !== 'tree') {
    return true
  }
  try {
    await loadCreatedTreeReference()
    return true
  } catch (error) {
    if (error.output?.statusCode === statusCodes.notFound) {
      return false
    }
    if (strict) {
      throw error
    }
    logger?.warn(
      `Retained tree shown read-only: the tree creation reference could not be loaded (${error.message})`
    )
    return false
  }
}

/**
 * The view-model fields that turn a retained details page into the reference
 * form: the heading, the shared reference input and error summary
 * (habitatRefFormFields), and what the form posts. `refusal` and
 * `submittedRef` are set when a save was refused.
 *
 * @param {{ feature: object, projectId: string, featureId: string, returnUrl?: string, cancelHref: string, submittedRef?: string, refusal?: { summary: string, inline: string } | { summaryOnly: string } }} params
 * @returns {object}
 */
export function retainedRefEditFields({
  feature,
  projectId,
  featureId,
  returnUrl,
  cancelHref,
  submittedRef,
  refusal
}) {
  const heading = `${HEADING_PREFIX} ${feature.ref ?? ''}`.trimEnd()
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
 * `{ refInvalid: true }` when the backend refuses one this side passed, or
 * `{ storedValueRefusal }` when the habitat holds a value saved before the
 * service checked text lengths and lists (stored-value-refusal.js). A
 * reference another habitat already carries is saved: references need not be
 * unique (AC7). Any other failure throws (backendSaveError).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {{ projectId: string, featureId: string, ref: string }} params
 *   `ref` has passed habitatRefRefusal; it is sent trimmed
 * @returns {Promise<{ type: string, feature: object } | { refInvalid: true } | { storedValueRefusal: { summaryOnly: string } | { summary: string, inline: string } }>}
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
    if (isStoredValueRefusal(err)) {
      return {
        storedValueRefusal: storedValueRefusal(err, {
          refTooLong: HABITAT_REF_TOO_LONG_ERROR
        })
      }
    }
    if (backendStatusOf(err) === statusCodes.badRequest) {
      return { refInvalid: true }
    }
    throw backendSaveError(err, featureId)
  }
}
