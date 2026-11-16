/**
 * The backend's refusal of an edit that leaves a degraded tree, the baseline
 * tree recorded as lost and created again in a lower condition, no longer a
 * degrade of it: DEGRADE_NOT_VALID (422), with the broken rule.
 *
 * The page offers every setting, condition and timing a Created tree can
 * take, so it is the backend that holds a degraded tree to its baseline
 * tree's. Each rule names the one field to blame.
 */

import { formErrorText } from '../error-text/error-text.js'
import { statusCodes } from '../constants.js'
import { backendStatusOf } from './backend-save-error.js'

export const DEGRADE_NOT_VALID_CODE = 'DEGRADE_NOT_VALID'

/** Each degrade rule's field, and its wording (error-text.yaml, forms). */
const FIELD_BY_RULE = Object.freeze({
  'degrade-same-setting': ['habitatType', 'degradeSameSetting'],
  'degrade-worse-condition': ['condition', 'degradeNotWorse'],
  'degrade-advance-30-plus': ['advanceYears', 'degradeNot30Plus']
})

/**
 * Whether a failed save is the backend refusing a degraded tree's edit.
 *
 * @param {unknown} err what backendRequest threw
 * @returns {boolean}
 */
export function isInvalidDegradeError(err) {
  return (
    backendStatusOf(err) === statusCodes.unprocessableEntity &&
    err?.data?.payload?.code === DEGRADE_NOT_VALID_CODE
  )
}

/**
 * The field a degraded tree's refused edit is to blame on, with its error,
 * or null when the failed save is not that refusal, or names a rule the page
 * does not know.
 *
 * @param {unknown} err what backendRequest threw
 * @returns {Record<string, { summary: string, inline: string }> | null}
 */
export function invalidDegradeErrors(err) {
  if (!isInvalidDegradeError(err)) {
    return null
  }
  // Own keys only: a rule such as "constructor" is not one the page knows.
  const { rule: brokenRule } = err.data.payload
  const match = Object.hasOwn(FIELD_BY_RULE, brokenRule ?? '')
    ? FIELD_BY_RULE[brokenRule]
    : null
  if (!match) {
    return null
  }
  const [field, rule] = match
  // The wording is filed under the form field it is shown against; the
  // timing errors share advanceOrDelay's.
  const wordingField = field === 'advanceYears' ? 'advanceOrDelay' : field
  return { [field]: formErrorText(wordingField, rule) }
}
