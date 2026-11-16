/**
 * The backend's refusal of an edit that leaves an enhanced habitat no valid
 * enhancement of its baseline: ENHANCEMENT_NOT_VALID (422), with the broken
 * enhancement rule.
 *
 * The Enhanced tree page offers only the target conditions better than the
 * tree's baseline condition, so a page in step with the backend cannot raise
 * it. A page loaded before the baseline tree was edited in another tab can,
 * and its condition is then the field to blame.
 */

import { statusCodes } from '../constants.js'
import { backendStatusOf } from './backend-save-error.js'

export const ENHANCEMENT_NOT_VALID_CODE = 'ENHANCEMENT_NOT_VALID'

/**
 * Whether a failed save is the backend refusing an enhancement as not valid
 * for its baseline.
 *
 * @param {unknown} err what backendRequest threw
 * @returns {boolean}
 */
export function isInvalidEnhancementError(err) {
  return (
    backendStatusOf(err) === statusCodes.unprocessableEntity &&
    err?.data?.payload?.code === ENHANCEMENT_NOT_VALID_CODE
  )
}
