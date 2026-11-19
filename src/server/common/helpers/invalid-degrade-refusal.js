/**
 * The backend's refusal of an edit that leaves an Existing tree Created over
 * its baseline tree, with no delay, not in a lower condition or not created
 * 30+ years in advance, the Metric guide's steps for a tree whose condition
 * gets worse: TREE_DEGRADE_NOT_VALID (422), with the broken rule.
 *
 * The page offers every condition and timing a Created tree can take, so it
 * is the backend that holds the tree to its baseline tree's. Each rule names
 * the one field to blame.
 */

import { formErrorText } from '../error-text/error-text.js'
import { statusCodes } from '../constants.js'
import { backendStatusOf } from './backend-save-error.js'

export const DEGRADE_NOT_VALID_CODE = 'TREE_DEGRADE_NOT_VALID'

/**
 * Each degrade rule's field, and its wording (error-text.yaml, forms), read
 * when the module loads, so a missing key fails at start-up rather than when
 * a user meets the refusal. The timing errors share advanceOrDelay's wording.
 */
const FIELD_BY_RULE = Object.freeze({
  'degrade-worse-condition': [
    'condition',
    formErrorText('condition', 'degradeNotWorse')
  ],
  'degrade-advance-30-plus': [
    'advanceYears',
    formErrorText('advanceOrDelay', 'degradeNot30Plus')
  ]
})

/**
 * Whether a failed save is the backend refusing such a tree's edit.
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
 * The field such a tree's refused edit is to blame on, with its error,
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
  const [field, error] = match
  return { [field]: { ...error } }
}
