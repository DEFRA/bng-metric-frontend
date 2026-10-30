/**
 * Habitat reference rules for the baseline details page (BMD-1061).
 *
 * They mirror the backend's import rules (BMD-1058), which the backend applies
 * again on save: a reference must have at least one character that is not
 * whitespace and must be UTF-8 text. A reference longer than the limit is
 * trimmed and truncated on save rather than refused, so length is not an error
 * here — the input stops at the limit anyway.
 */

export const MAX_HABITAT_REF_LENGTH = 100

// Content design wording: one message pair for every invalid reference
// (blank, whitespace only or not UTF-8). The error summary and the inline
// message say different things by design.
export const HABITAT_REF_ERROR = Object.freeze({
  summary: 'You have entered an invalid habitat reference.',
  inline: 'Enter a valid habitat reference.'
})

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
