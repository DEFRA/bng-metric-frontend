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

// Placeholder GDS-style wording until the content designer confirms it
// (BMD-1061 open point).
export const HABITAT_REF_ERRORS = Object.freeze({
  missing: 'Enter a habitat reference',
  invalidCharacters:
    'Habitat reference must only include characters that can be saved'
})

// What a UTF-8 decoder puts in place of bytes that are not valid UTF-8.
const REPLACEMENT_CHARACTER = '�'

/**
 * @param {unknown} value the submitted habitat reference
 * @returns {string | null} the error message, or null when the value is valid
 */
export function habitatRefError(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed === '') {
    return HABITAT_REF_ERRORS.missing
  }
  if (trimmed.includes(REPLACEMENT_CHARACTER) || !trimmed.isWellFormed()) {
    return HABITAT_REF_ERRORS.invalidCharacters
  }
  return null
}
