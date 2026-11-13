/** The character a UTF-8 decoder puts in place of bytes that are not valid UTF-8. */
export const REPLACEMENT_CHARACTER = '�'

/**
 * Whether text holds characters that are not UTF-8: the replacement character
 * a decoder puts in place of invalid bytes, or a lone surrogate, which has no
 * UTF-8 encoding at all. Shared by the habitat reference and the comment.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function hasInvalidUtf8Text(text) {
  return text.includes(REPLACEMENT_CHARACTER) || !text.isWellFormed()
}
