/**
 * The backend's refusal of an edit it cannot carry out on this feature, as
 * against a value it will not accept: FEATURE_NOT_EDITABLE (400).
 *
 * The backend refuses an edit that would make a habitat something its kind
 * cannot become: a tree that is no longer a tree (keepsTreeATree), or a
 * vertical area habitat that is no longer vertical. The dropdowns do not offer
 * such a change — a tree is fixed to Individual trees and offered only its two
 * settings (BMD-1172) — so a page in step with the backend cannot raise it,
 * but a stale page or a crafted post can.
 *
 * The refusal shares the 400 a refused reference gets, so without its code the
 * details page cannot tell the two apart: it blames a reference that is
 * perfectly valid, or, when the reference was not touched, throws and drops
 * the user on an error page that loses the supporting information they typed.
 * No field the page can edit is to blame, so it is shown in the error summary
 * only, keeping what was submitted, as a stored-value refusal is
 * (stored-value-refusal.js).
 */

import { editErrorText } from '../error-text/error-text.js'
import { backendStatusOf } from './backend-save-error.js'

export const FEATURE_NOT_EDITABLE_CODE = 'FEATURE_NOT_EDITABLE'

const BAD_REQUEST = 400

const wording = editErrorText(FEATURE_NOT_EDITABLE_CODE)
if (!wording?.summaryOnly) {
  throw new Error(
    `error-text.yaml's edit section has no summaryOnly wording for ${FEATURE_NOT_EDITABLE_CODE}`
  )
}

/**
 * Whether a failed save is the backend refusing the edit as one it cannot
 * carry out on this feature.
 *
 * @param {unknown} err what backendRequest threw
 * @returns {boolean}
 */
export function isFeatureNotEditableError(err) {
  return (
    backendStatusOf(err) === BAD_REQUEST &&
    err?.data?.payload?.code === FEATURE_NOT_EDITABLE_CODE
  )
}

/**
 * The page-level error for the backend's FEATURE_NOT_EDITABLE refusal.
 *
 * @returns {{ summaryOnly: string }}
 */
export function featureNotEditableRefusal() {
  return { summaryOnly: wording.summaryOnly }
}
