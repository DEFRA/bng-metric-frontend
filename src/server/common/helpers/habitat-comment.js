/**
 * Comment rules and form fields for the baseline habitat details page
 * (BMD-1112). They mirror the backend's comment rules (comment-check.js):
 * blank is allowed, length is counted in Unicode code points after trimming,
 * and text that is not UTF-8 is refused. The visible label is "Supporting
 * information"; the field name stays `comment`.
 *
 * A browser newline-normalises a textarea's value to CRLF when it submits the
 * form, so every line break comes back one character longer than it went out.
 * Left alone, a saved comment of exactly the maximum length holding one would
 * be refused the next time the page was saved, and this page and the upload
 * would store the same text differently. `cleanComment` puts line breaks back
 * to LF, and everything that counts or saves a comment goes through it.
 */

import { formErrorText } from '../error-text/error-text.js'
import { hasInvalidUtf8Text } from './utf8-text.js'

/**
 * Mirrors the backend's MAX_COMMENT_LENGTH (comment-check.js), which since
 * BMD-1175 is LONG_TEXT_LIMIT from text-limits.js: one limit shared by every
 * 999-character free-text column of an upload, in both templates. The feature
 * edit route checks it again on save (shared-params.js), so the two sides have
 * to agree — change it there first, then here.
 */
export const MAX_COMMENT_LENGTH = 999

// The textarea's id and name, which the error summary links to.
export const COMMENT_FIELD_ID = 'comment'

// A CR, or a CRLF pair, as a browser submits a line break.
const CARRIAGE_RETURN = /\r\n?/g

// One message pair per rule, from error-text.yaml's forms section.
export const COMMENT_INVALID_CHARACTERS_ERROR = Object.freeze(
  formErrorText(COMMENT_FIELD_ID, 'invalidCharacters')
)

export const COMMENT_TOO_LONG_ERROR = Object.freeze(
  formErrorText(COMMENT_FIELD_ID, 'tooLong', { max: MAX_COMMENT_LENGTH })
)

/**
 * The comment as the form keeps it: line breaks as LF, leading and trailing
 * whitespace removed, and a blank left as an empty string so the text box
 * stays empty. Whitespace within the text is kept.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function cleanComment(value) {
  return typeof value === 'string'
    ? value.replaceAll(CARRIAGE_RETURN, '\n').trim()
    : ''
}

/**
 * The comment rules the submitted value breaks, invalid characters first,
 * then length. Empty and whitespace-only break none. A value can break both.
 *
 * @param {unknown} value
 * @returns {Array<{ summary: string, inline: string }>}
 */
export function commentRefusals(value) {
  const cleaned = cleanComment(value)
  if (cleaned === '') {
    return []
  }
  const refusals = []
  if (hasInvalidUtf8Text(cleaned)) {
    refusals.push(COMMENT_INVALID_CHARACTERS_ERROR)
  }
  if (Array.from(cleaned).length > MAX_COMMENT_LENGTH) {
    refusals.push(COMMENT_TOO_LONG_ERROR)
  }
  return refusals
}

// Characters that would be markup if a message were placed in the error html.
const HTML_ESCAPE = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})

/**
 * @param {string} text
 * @returns {string}
 */
function escapeInline(text) {
  return text.replaceAll(/[&<>"']/g, (character) => HTML_ESCAPE[character])
}

/**
 * The message shown against the text box. One failed rule is the GOV.UK
 * error message's text. Both rules are the same component, each message on
 * its own line and invalid characters first, matching the summary (BMD-1112
 * AC5).
 *
 * @param {Array<{ inline: string }>} refusals
 * @returns {{ text: string } | { html: string } | undefined}
 */
function inlineError(refusals) {
  if (refusals.length === 0) {
    return undefined
  }
  if (refusals.length === 1) {
    return { text: refusals[0].inline }
  }
  return {
    html: refusals.map((refusal) => escapeInline(refusal.inline)).join('<br>')
  }
}

/**
 * The error summary entries and the textarea for the supporting information.
 * Deliberately returns neither a page title nor an `errors` key: the details
 * page composes both once the reference and the comment have been checked, so
 * neither field's fields can quietly overwrite the other's.
 *
 * @param {{ savedComment?: string | null, submittedComment?: string, refusals?: Array<{ summary: string, inline: string }> }} params
 * @returns {{ commentErrors: Array<{ text: string, href: string }>, commentInput: { id: string, value: string, error?: { text: string } | { html: string } } }}
 */
export function commentFormFields({
  savedComment,
  submittedComment,
  refusals = []
}) {
  return {
    commentErrors: refusals.map((refusal) => ({
      text: refusal.summary,
      href: `#${COMMENT_FIELD_ID}`
    })),
    commentInput: {
      id: COMMENT_FIELD_ID,
      value: submittedComment ?? savedComment ?? '',
      error: inlineError(refusals)
    }
  }
}
