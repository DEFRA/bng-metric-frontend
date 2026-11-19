/**
 * The backend's refusal of an edit that leaves a habitat whose condition gets
 * worse, with no delay, not in a lower condition or not created 30+ years in
 * advance, the Metric guide's steps for one (422, with the broken rule):
 *
 * - TREE_DEGRADE_NOT_VALID: an Existing tree Created over its baseline tree;
 * - HABITAT_DEGRADE_NOT_VALID: an area habitat or hedgerow Created in its
 *   parent's own habitat type.
 *
 * The page offers every condition and timing a Created habitat can take, so
 * it is the backend that holds it to its parent's. Each rule names the one
 * field to blame, and each code words it for what can be done instead: a tree
 * planted in its place is Newly Planted, a habitat cleared and put back gives
 * a delay.
 */

import { formErrorText } from '../error-text/error-text.js'
import { statusCodes } from '../constants.js'
import { backendStatusOf } from './backend-save-error.js'

export const DEGRADE_NOT_VALID_CODE = 'TREE_DEGRADE_NOT_VALID'
export const HABITAT_DEGRADE_NOT_VALID_CODE = 'HABITAT_DEGRADE_NOT_VALID'

/**
 * Each code's rules: the field each is shown against, and its wording
 * (error-text.yaml, forms), read when the module loads, so a missing key
 * fails at start-up rather than when a user meets the refusal. The timing
 * errors share advanceOrDelay's wording.
 */
const FIELD_BY_CODE = Object.freeze({
  [DEGRADE_NOT_VALID_CODE]: Object.freeze({
    'degrade-worse-condition': [
      'condition',
      formErrorText('condition', 'degradeNotWorse')
    ],
    'degrade-advance-30-plus': [
      'advanceYears',
      formErrorText('advanceOrDelay', 'degradeNot30Plus')
    ]
  }),
  [HABITAT_DEGRADE_NOT_VALID_CODE]: Object.freeze({
    'degrade-worse-condition': [
      'condition',
      formErrorText('condition', 'habitatDegradeNotWorse')
    ],
    'degrade-advance-30-plus': [
      'advanceYears',
      formErrorText('advanceOrDelay', 'habitatDegradeNot30Plus')
    ]
  })
})

/**
 * Whether a failed save is the backend refusing such a habitat's edit.
 *
 * @param {unknown} err what backendRequest threw
 * @returns {boolean}
 */
export function isInvalidDegradeError(err) {
  return (
    backendStatusOf(err) === statusCodes.unprocessableEntity &&
    Object.hasOwn(FIELD_BY_CODE, err?.data?.payload?.code ?? '')
  )
}

/**
 * The field such a habitat's refused edit is to blame on, with its error,
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
  const { code, rule: brokenRule } = err.data.payload
  const rules = FIELD_BY_CODE[code]
  const match = Object.hasOwn(rules, brokenRule ?? '')
    ? rules[brokenRule]
    : null
  if (!match) {
    return null
  }
  const [field, error] = match
  return { [field]: { ...error } }
}
