/**
 * Habitat reference rules and form fields, shared by the baseline details page
 * (BMD-1061) and the retained post-intervention details page (BMD-1180), so the
 * two forms cannot drift apart.
 *
 * They mirror the backend's import rules (BMD-1058, BMD-1175), which the
 * backend applies again on save: a reference must have at least one character
 * that is not whitespace, must be UTF-8 text, and must be no longer than
 * MAX_HABITAT_REF_LENGTH characters once trimmed. A longer one is refused,
 * never cut. The input stops typing at the limit, but a habitat imported
 * before BMD-1175 may already hold a longer one, which the input shows whole.
 */

import { editErrorText, formErrorText } from '../error-text/error-text.js'
import { backendStatusOf } from './backend-save-error.js'
import { hasInvalidUtf8Text } from './utf8-text.js'

// In characters (Unicode code points), as the backend counts them. The
// tooLong wording in error-text.yaml names the same number.
export const MAX_HABITAT_REF_LENGTH = 99

// The input's id and name on both forms, which the error summary links to.
export const HABITAT_REF_FIELD_ID = 'habitatRef'

const HABITAT_REF_IN_USE_CODE = 'HABITAT_REF_IN_USE'

// One message pair for every invalid reference (blank, whitespace only or not
// UTF-8), from error-text.yaml's forms section.
export const HABITAT_REF_ERROR = Object.freeze(
  formErrorText(HABITAT_REF_FIELD_ID, 'invalid')
)

// A reference longer than MAX_HABITAT_REF_LENGTH characters once trimmed.
export const HABITAT_REF_TOO_LONG_ERROR = Object.freeze(
  formErrorText(HABITAT_REF_FIELD_ID, 'tooLong', {
    max: MAX_HABITAT_REF_LENGTH
  })
)

// A rename onto a reference another baseline habitat in the same layer already
// carries, which the backend refuses with HABITAT_REF_IN_USE: error-text.yaml's
// edit section.
const refInUse = editErrorText(HABITAT_REF_IN_USE_CODE)
if (!refInUse?.inline) {
  throw new Error(
    `error-text.yaml's edit section has no summary and inline wording for ${HABITAT_REF_IN_USE_CODE}`
  )
}
export const HABITAT_REF_IN_USE_ERROR = Object.freeze(refInUse)
const UNPROCESSABLE = 422

/**
 * @param {unknown} value the submitted habitat reference
 * @returns {boolean} whether the reference can be saved
 */
export function isValidHabitatRef(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed !== '' && !hasInvalidUtf8Text(trimmed)
}

/**
 * Whether a reference is longer than MAX_HABITAT_REF_LENGTH characters once
 * trimmed, counted as the backend counts them.
 *
 * @param {unknown} value the submitted habitat reference
 * @returns {boolean}
 */
export function isHabitatRefTooLong(value) {
  return (
    typeof value === 'string' &&
    Array.from(value.trim()).length > MAX_HABITAT_REF_LENGTH
  )
}

/**
 * Why a submitted reference cannot be saved, or null when it can.
 *
 * @param {unknown} value the submitted habitat reference
 * @returns {{ summary: string, inline: string } | null}
 */
export function habitatRefRefusal(value) {
  if (!isValidHabitatRef(value)) {
    return HABITAT_REF_ERROR
  }
  return isHabitatRefTooLong(value) ? HABITAT_REF_TOO_LONG_ERROR : null
}

/**
 * Whether a failed save is the backend refusing the new reference because
 * another habitat already carries it.
 *
 * @param {unknown} err what backendRequest threw
 * @returns {boolean}
 */
export function isRefInUseError(err) {
  return (
    backendStatusOf(err) === UNPROCESSABLE &&
    err?.data?.payload?.code === HABITAT_REF_IN_USE_CODE
  )
}

/**
 * The error summary's list for a refusal: one linked to the reference input,
 * or, for a refusal no one field can put right (`summaryOnly`, as
 * stored-value-refusal.js gives), one linked to nothing.
 *
 * @param {{ summary: string, inline: string } | { summaryOnly: string } | undefined} refusal
 * @returns {Array<{ text: string, href?: string }>}
 */
function refusalErrors(refusal) {
  if (!refusal) {
    return []
  }
  if (refusal.summaryOnly) {
    return [{ text: refusal.summaryOnly }]
  }
  return [{ text: refusal.summary, href: `#${HABITAT_REF_FIELD_ID}` }]
}

/**
 * The page title, error summary and reference input for a form holding the
 * habitat reference. `refusal` (HABITAT_REF_ERROR, HABITAT_REF_TOO_LONG_ERROR,
 * HABITAT_REF_IN_USE_ERROR or a stored value refusal)
 * is set when a save was refused: the input then shows what was typed, and the
 * page carries the error. The heading names the habitat by its saved
 * reference either way.
 *
 * @param {{ heading: string, savedRef?: string | number | null, submittedRef?: string, refusal?: { summary: string, inline: string } | { summaryOnly: string } }} params
 * @returns {{ pageTitle: string, errors: Array<{ text: string, href?: string }>, habitatRefInput: { id: string, value: string, error?: { text: string }, maxLength: number } }}
 */
export function habitatRefFormFields({
  heading,
  savedRef,
  submittedRef,
  refusal
}) {
  return {
    pageTitle: refusal ? `Error: ${heading}` : heading,
    errors: refusalErrors(refusal),
    habitatRefInput: {
      id: HABITAT_REF_FIELD_ID,
      value: submittedRef ?? storedRefText(savedRef),
      error: refusal?.inline ? { text: refusal.inline } : undefined,
      maxLength: MAX_HABITAT_REF_LENGTH
    }
  }
}

/**
 * A stored reference as text, as the page puts it in the input.
 *
 * @param {string | number | null | undefined} ref
 * @returns {string}
 */
export function storedRefText(ref) {
  return typeof ref === 'string' || typeof ref === 'number' ? `${ref}` : ''
}

/**
 * Whether a submitted reference leaves the stored one as it is. A text input
 * drops line breaks from its value, so a stored reference holding one comes
 * back without it though the user never touched the field.
 *
 * @param {string} submitted
 * @param {string | number | null | undefined} stored
 * @returns {boolean}
 */
export function isRefUnchanged(submitted, stored) {
  const shown = storedRefText(stored).replaceAll(/[\r\n]/g, '')
  return submitted === shown || (submitted.trim() === '' && shown.trim() === '')
}
