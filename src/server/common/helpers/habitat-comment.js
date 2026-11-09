/**
 * Comment rules and form fields for the baseline habitat details page
 * (BMD-1112). They mirror the backend's comment rules (comment-check.js):
 * blank is allowed, length is counted in Unicode code points after trimming,
 * and text that is not UTF-8 is refused. The visible label is "Supporting
 * information"; the field name stays `comment`.
 */

import { hasInvalidUtf8Text } from './utf8-text.js'

/** Mirrors backend comment-check.js MAX_COMMENT_LENGTH. */
export const MAX_COMMENT_LENGTH = 999

// The textarea's id and name, which the error summary links to.
export const COMMENT_FIELD_ID = 'comment'

// Placeholder wording until content design words it (BMD-1112 open point).
export const COMMENT_INVALID_CHARACTERS_ERROR = Object.freeze({
  summary:
    'PLACEHOLDER: The supporting information uses characters that are not allowed',
  inline: 'PLACEHOLDER: Supporting information can only use UTF-8 characters'
})

export const COMMENT_TOO_LONG_ERROR = Object.freeze({
  summary: 'PLACEHOLDER: The supporting information is too long',
  inline: `PLACEHOLDER: Supporting information must be ${MAX_COMMENT_LENGTH} characters or less`
})

/**
 * The comment rules the submitted value breaks, invalid characters first,
 * then length. Empty and whitespace-only break none. A value can break both.
 *
 * @param {unknown} value
 * @returns {Array<{ summary: string, inline: string }>}
 */
export function commentRefusals(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed === '') {
    return []
  }
  const refusals = []
  if (hasInvalidUtf8Text(trimmed)) {
    refusals.push(COMMENT_INVALID_CHARACTERS_ERROR)
  }
  if (Array.from(trimmed).length > MAX_COMMENT_LENGTH) {
    refusals.push(COMMENT_TOO_LONG_ERROR)
  }
  return refusals
}

/**
 * The comment as the form keeps it: trimmed, with a blank left as an empty
 * string so the text box stays empty.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function cleanComment(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The error summary entries and the textarea for the supporting information.
 * Deliberately has no page title: the details page composes that once both
 * the reference and the comment have been checked.
 *
 * The inline message is HTML so every failed rule is named. The strings are
 * the frozen constants above, never the user's text, so there is nothing to
 * escape.
 *
 * @param {{ savedComment?: string | null, submittedComment?: string, refusals?: Array<{ summary: string, inline: string }> }} params
 * @returns {{ errors: Array<{ text: string, href: string }>, commentInput: { id: string, value: string, error?: { html: string } } }}
 */
export function commentFormFields({
  savedComment,
  submittedComment,
  refusals = []
}) {
  return {
    errors: refusals.map((refusal) => ({
      text: refusal.summary,
      href: `#${COMMENT_FIELD_ID}`
    })),
    commentInput: {
      id: COMMENT_FIELD_ID,
      value: submittedComment ?? savedComment ?? '',
      error: refusals.length
        ? { html: refusals.map((refusal) => refusal.inline).join('<br>') }
        : undefined
    }
  }
}
