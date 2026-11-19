// A control character, DEL or half of a UTF-16 surrogate pair: text that is
// not valid UTF-8 once saved, or that no one could have meant to type.
const LAST_C0_CONTROL_CODE = 0x1f
const DELETE_CODE = 0x7f
const FIRST_SURROGATE_CODE = 0xd800
const LAST_SURROGATE_CODE = 0xdfff

/**
 * @param {string} value
 * @returns {boolean}
 */
export function hasInvalidCharacters(value) {
  return [...value].some((char) => {
    const codePoint = char.codePointAt(0)
    return (
      codePoint <= LAST_C0_CONTROL_CODE ||
      codePoint === DELETE_CODE ||
      (codePoint >= FIRST_SURROGATE_CODE && codePoint <= LAST_SURROGATE_CODE)
    )
  })
}

/**
 * A Joi `.custom()` check that fails a string holding an invalid character
 * with `string.invalidChars`, for the schema's `.messages()` to word.
 */
export function validCharacters(value, helpers) {
  return hasInvalidCharacters(value)
    ? helpers.error('string.invalidChars')
    : value
}
