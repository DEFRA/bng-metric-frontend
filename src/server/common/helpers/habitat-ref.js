/**
 * Habitat reference rules and form fields, shared by the baseline details page
 * (BMD-1061) and the retained post-intervention details page (BMD-1180), so the
 * two forms cannot drift apart.
 *
 * They mirror the backend's import rules (BMD-1058), which the backend applies
 * again on save: a reference must have at least one character that is not
 * whitespace and must be UTF-8 text. A reference longer than the limit is
 * trimmed and truncated on save rather than refused, so length is not an error
 * here — the input stops at the limit anyway.
 */

import { backendStatusOf } from './backend-save-error.js'

export const MAX_HABITAT_REF_LENGTH = 100

// The input's id and name on both forms, which the error summary links to.
export const HABITAT_REF_FIELD_ID = 'habitatRef'

// Content design wording: one message pair for every invalid reference
// (blank, whitespace only or not UTF-8). The error summary and the inline
// message say different things by design.
export const HABITAT_REF_ERROR = Object.freeze({
  summary: 'You have entered an invalid habitat reference.',
  inline: 'Enter a valid habitat reference.'
})

// A rename onto a reference another baseline habitat in the same layer already
// carries, which the backend refuses with HABITAT_REF_IN_USE. Placeholder
// wording until content design words it.
export const HABITAT_REF_IN_USE_ERROR = Object.freeze({
  summary: 'You have entered a habitat reference that is already in use.',
  inline: 'Enter a habitat reference that is not already in use.'
})

const HABITAT_REF_IN_USE_CODE = 'HABITAT_REF_IN_USE'
const UNPROCESSABLE = 422

// What a UTF-8 decoder puts in place of bytes that are not valid UTF-8.
const REPLACEMENT_CHARACTER = '�'

/**
 * @param {unknown} value the submitted habitat reference
 * @returns {boolean} whether the reference can be saved
 */
export function isValidHabitatRef(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return (
    trimmed !== '' &&
    !trimmed.includes(REPLACEMENT_CHARACTER) &&
    trimmed.isWellFormed()
  )
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
 * The page title, error summary and reference input for a form holding the
 * habitat reference. `refusal` (HABITAT_REF_ERROR or HABITAT_REF_IN_USE_ERROR)
 * is set when a save was refused: the input then shows what was typed, and the
 * page carries the error. The heading names the habitat by its saved
 * reference either way.
 *
 * @param {{ heading: string, savedRef?: unknown, submittedRef?: string, refusal?: { summary: string, inline: string } }} params
 * @returns {{ pageTitle: string, errors: Array<{ text: string, href: string }>, habitatRefInput: { id: string, value: string, error?: { text: string }, maxLength: number } }}
 */
export function habitatRefFormFields({
  heading,
  savedRef,
  submittedRef,
  refusal
}) {
  const savedValue =
    savedRef === null || savedRef === undefined ? '' : `${savedRef}`
  return {
    pageTitle: refusal ? `Error: ${heading}` : heading,
    errors: refusal
      ? [{ text: refusal.summary, href: `#${HABITAT_REF_FIELD_ID}` }]
      : [],
    habitatRefInput: {
      id: HABITAT_REF_FIELD_ID,
      value: submittedRef ?? savedValue,
      error: refusal ? { text: refusal.inline } : undefined,
      maxLength: MAX_HABITAT_REF_LENGTH
    }
  }
}
