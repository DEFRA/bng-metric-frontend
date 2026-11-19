import { statusCodes } from '../common/constants.js'
import {
  isStoredValueRefusal,
  storedValueRefusal
} from '../common/helpers/stored-value-refusal.js'
import {
  featureNotEditableRefusal,
  isFeatureNotEditableError
} from '../common/helpers/feature-not-editable-refusal.js'
import { isInvalidEnhancementError } from '../common/helpers/invalid-enhancement-refusal.js'
import { invalidDegradeErrors } from '../common/helpers/invalid-degrade-refusal.js'

// The backend refusals a Created or Enhanced edit page can show again, each
// with its status. Split out of controller.js, which saves the page.

/**
 * What a Created or Enhanced edit page shows again for a save the backend
 * refused, and its status, or null for a refusal the page cannot show.
 *
 * @param {unknown} err what the save threw
 * @param {object} kind its CREATED_EDIT_KINDS entry
 * @returns {{ shown: object, statusCode: number } | null}
 */
export function shownSaveRefusal(err, kind) {
  // A value saved before the service checked text lengths and lists
  // refuses any save of the habitat, whatever was changed.
  if (isStoredValueRefusal(err)) {
    return {
      shown: { refusal: storedValueRefusal(err) },
      statusCode: statusCodes.badRequest
    }
  }
  // A stale page or a crafted post asking for a tree that is no longer a
  // tree: shown in the error summary, keeping what was chosen.
  if (isFeatureNotEditableError(err)) {
    return {
      shown: { refusal: featureNotEditableRefusal() },
      statusCode: statusCodes.badRequest
    }
  }
  // A page that offered an Enhanced tree or area habitat a target condition
  // its baseline no longer allows, such as after an edit to the baseline in
  // another tab: the condition is to blame.
  if (isInvalidEnhancementError(err) && kind.conditionError) {
    return {
      shown: { errors: { condition: kind.conditionError } },
      statusCode: statusCodes.unprocessableEntity
    }
  }
  // An Existing tree Created over its baseline tree given a condition or
  // timing the guide's steps for a tree whose condition gets worse refuse:
  // the field the backend's rule names is to blame.
  const degradeErrors = invalidDegradeErrors(err)
  return degradeErrors
    ? {
        shown: { errors: degradeErrors },
        statusCode: statusCodes.unprocessableEntity
      }
    : null
}
