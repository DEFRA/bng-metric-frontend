/**
 * The backend's refusal of an edit to a habitat saved before it checked text
 * lengths and lists (BMD-1175). Such a habitat still holds a value over its
 * limit or outside its list, so the backend refuses every save of it, even
 * one that leaves that value as it is, with STORED_VALUE_NOT_ALLOWED (422).
 * Its payload names the fields by their paths in the stored habitat, as in
 * `fields: ["ref", "proposed.condition"]`; an older backend names them only
 * in its message, as in "(ref, proposed.condition)". No field on the page is
 * to blame, so the edit pages show the refusal in the error summary only,
 * naming the fields in plain words, from error-text.yaml's edit section. The
 * one exception is a reference too long, alone, on a page that can edit it:
 * the user can shorten it there.
 */

import { editErrorText } from '../error-text/error-text.js'
import { backendStatusOf } from './backend-save-error.js'

export const STORED_VALUE_NOT_ALLOWED_CODE = 'STORED_VALUE_NOT_ALLOWED'

const UNPROCESSABLE = 422

const wording = editErrorText(STORED_VALUE_NOT_ALLOWED_CODE)
if (!wording?.summaryOnly) {
  throw new Error(
    `error-text.yaml's edit section has no summaryOnly wording for ${STORED_VALUE_NOT_ALLOWED_CODE}`
  )
}

// The stored fields the backend checks, in plain words. A path's last part
// names the field; the part before it says whether it is the baseline or the
// proposed value.
const FIELD_WORDS = new Map([
  ['ref', 'habitat reference'],
  ['type', 'habitat type'],
  ['broadType', 'broad habitat'],
  ['condition', 'condition'],
  ['strategicSignificance', 'strategic significance'],
  ['retentionCategory', 'retention category'],
  ['rawDistinctiveness', 'distinctiveness'],
  ['watercourseEncroachment', 'encroachment into watercourse'],
  ['riparianEncroachment', 'encroachment into riparian zone'],
  ['enhancementType', 'enhancement type'],
  ['treeSize', 'tree size'],
  ['treeSpecies', 'tree type'],
  ['ruralOrUrban', 'rural or urban tree'],
  ['comment', 'comment'],
  ['location', 'location'],
  ['spatialRiskCategory', 'spatial risk category'],
  ['habitatCreatedInAdvanceYears', 'years created in advance'],
  ['delayInStartingHabitatCreationYears', 'years of delay in starting creation']
])

const STAGE_WORDS = new Map([
  ['baseline', 'baseline'],
  ['proposed', 'proposed']
])

// What the page says when the backend names no field it can read.
const NO_FIELDS = 'details'

// The fields, between the brackets of an older backend's message.
const FIELDS_IN_MESSAGE = /\(([^()]+)\)/

const REF_PATH = 'ref'

const ARRAY_INDEX = /^\d+$/

/**
 * Whether a failed save is the backend refusing it because the habitat holds
 * a value saved before it checked text lengths and lists.
 *
 * @param {unknown} err what backendRequest threw
 * @returns {boolean}
 */
export function isStoredValueRefusal(err) {
  return (
    backendStatusOf(err) === UNPROCESSABLE &&
    err?.data?.payload?.code === STORED_VALUE_NOT_ALLOWED_CODE
  )
}

/**
 * A stored field's path in plain words, as in "proposed condition" for
 * `proposed.condition`, or the path itself for a field this side does not
 * know.
 *
 * @param {string} path
 * @returns {string}
 */
export function storedFieldWords(path) {
  const parts = path.split('.').filter((part) => !ARRAY_INDEX.test(part))
  const field = FIELD_WORDS.get(parts.at(-1))
  const stages = parts.slice(0, -1)
  if (!field || stages.length > 1) {
    return path
  }
  if (stages.length === 0) {
    return field
  }
  const stage = STAGE_WORDS.get(stages[0])
  return stage ? `${stage} ${field}` : path
}

/**
 * Words joined as a list: "a", "a and b", "a, b and c".
 *
 * @param {string[]} words
 * @returns {string}
 */
function joinWords(words) {
  if (words.length <= 1) {
    return words.join('')
  }
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

/**
 * The paths of the fields the backend refused: its payload's `fields`, or,
 * from an older backend, those between the brackets of its message.
 *
 * @param {unknown} payload the backend's error payload
 * @returns {string[]}
 */
export function refusedPaths(payload) {
  const fields = payload?.fields
  if (Array.isArray(fields)) {
    return fields.filter((path) => typeof path === 'string' && path !== '')
  }
  const message = payload?.message
  const inBrackets =
    typeof message === 'string' ? FIELDS_IN_MESSAGE.exec(message)?.[1] : null
  return (inBrackets ?? '')
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean)
}

/**
 * The refused fields in plain words, each once.
 *
 * @param {string[]} paths
 * @returns {string}
 */
export function refusedFieldWords(paths) {
  const words = [...new Set(paths.map(storedFieldWords))]
  return words.length ? joinWords(words) : NO_FIELDS
}

/**
 * The error for the backend's STORED_VALUE_NOT_ALLOWED refusal. On a page
 * that can edit the reference, `refTooLong` is its error for a reference too
 * long; when the reference is the only field refused, that is the error, at
 * the field, as shortening it there lets the save pass. Otherwise it is a
 * page-level error naming the fields. The text is for a template to escape:
 * it holds paths from the backend as they are when it does not know them.
 *
 * @param {unknown} err what backendRequest threw (isStoredValueRefusal)
 * @param {{ refTooLong?: { summary: string, inline: string } }} [page]
 * @returns {{ summaryOnly: string } | { summary: string, inline: string }}
 */
export function storedValueRefusal(err, { refTooLong } = {}) {
  const paths = refusedPaths(err?.data?.payload)
  if (refTooLong && paths.length === 1 && paths[0] === REF_PATH) {
    return refTooLong
  }
  return {
    summaryOnly: wording.summaryOnly.replaceAll(
      '{fields}',
      refusedFieldWords(paths)
    )
  }
}
