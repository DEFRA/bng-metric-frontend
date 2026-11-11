import Joi from 'joi'

import { createLogger } from '../helpers/logging/logger.js'

// An entry in error-text.yaml says how far its wording has got only while it
// is not final, with a `wording` field: "none" has no wording yet, so the page
// shows a generic message, and "interim" is shown but has not been reviewed by
// UCD. An entry with no `wording` field is final. Every section reads it the
// same way, so a search for "wording:" finds everything UCD still has to word.

const logger = createLogger()

/** What an entry's `wording` field can say. */
export const WORDING = Object.freeze({
  NONE: 'none',
  INTERIM: 'interim'
})

/** How far an entry's wording has got, as wordingStatus gives it. */
export const WORDING_STATUS = Object.freeze({
  FINAL: 'final',
  INTERIM: WORDING.INTERIM,
  NONE: WORDING.NONE
})

const UNRECOGNISED = 'wording.unrecognised'

/**
 * The `wording` field. A value that is neither "none" nor "interim" is a
 * warning rather than an error, so a slip in it cannot stop the server
 * starting. Only wordingStatus reads it, as unfinished: the pages show the
 * entry's words as they would any others. The warning is for a
 * developer, so logErrorTextWarnings words it, not error-text.yaml.
 */
export const wordingField = Joi.any().custom((value, helpers) => {
  if (!Object.values(WORDING).includes(value)) {
    helpers.warn(UNRECOGNISED, { value })
  }
  return value
})

/**
 * The `wording` field of an entry whose words the page always shows, such as
 * a page or a shared fallback. "none" would say the page shows a generic
 * message instead, which it does not, so it is refused.
 */
export const shownWordingField = wordingField.invalid(WORDING.NONE)

/**
 * `schema`, refused when its entry's `wording` is "none": words there would
 * be shown, though the entry says it has none.
 *
 * @param {import('joi').Schema} schema
 */
export function forbiddenWhenNone(schema) {
  return schema.when('wording', { is: WORDING.NONE, then: Joi.forbidden() })
}

/**
 * `schema`, the words of an entry: refused when it has none, and otherwise
 * required. Only "none" itself frees an entry of its words, so one whose
 * `wording` is a slip, such as "nnoe", still needs them: without them the
 * page would have nothing to show.
 *
 * @param {import('joi').Schema} schema
 */
export function wordsUnlessNone(schema) {
  return schema.when('wording', {
    is: WORDING.NONE,
    then: Joi.forbidden(),
    otherwise: Joi.required()
  })
}

/**
 * Whether an entry's wording is final, interim or not written yet. A `wording`
 * the file's check warned about counts as not written yet.
 *
 * @param {unknown} entry - an entry from error-text.yaml, words or an object
 * @returns {'final' | 'interim' | 'none'}
 */
export function wordingStatus(entry) {
  const wording =
    entry !== null && typeof entry === 'object' ? entry.wording : undefined
  if (wording === undefined) {
    return WORDING_STATUS.FINAL
  }
  return wording === WORDING.INTERIM
    ? WORDING_STATUS.INTERIM
    : WORDING_STATUS.NONE
}

/**
 * Log each unrecognised `wording` a check of error-text.yaml warned of, with
 * the entry's place in the file.
 *
 * @param {import('joi').ValidationResult['warning']} warning
 * @param {string} [section] - the section that was checked, when not the whole file
 */
export function logErrorTextWarnings(warning, section) {
  const prefix = section ? `${section}.` : ''
  const unrecognised = (warning?.details ?? []).filter(
    ({ type }) => type === UNRECOGNISED
  )
  for (const { path, context } of unrecognised) {
    logger.warn(
      `error-text.yaml: ${prefix}${path.join('.')} is "${context.value}", which is neither "${WORDING.NONE}" nor "${WORDING.INTERIM}", so it counts as unfinished. The page still shows the entry's words`
    )
  }
}
