import { MAX_FILE_SIZE_BYTES } from '../../server/common/constants.js'
import { ERROR_INVALID_FILENAME } from '../../server/common/helpers/file-validation-messages.js'

// Pure validators for the upload form. Kept DOM-free so the rules can be
// unit-tested with plain objects; the DOM shell that wires these into the
// page lives in file-upload-validation.js.

const ALLOWED_EXTENSION = '.gpkg'
const MAX_FILE_SIZE_LABEL = '100 MB'
// Same allowed characters as the backend whitelist, including as the first
// character. The backend still requires a leading letter or digit; JS-off
// uploads of names like "(copy).gpkg" can still be rejected after CDP.
const MAX_FILENAME_LENGTH = 255
const SAFE_FILENAME_RE = /^[a-z0-9 ._()-]+\.gpkg$/i

const ERROR_NO_FILE = 'Select a GeoPackage (.gpkg) file'
const ERROR_WRONG_EXTENSION = 'The selected file must be a GeoPackage (.gpkg)'
const ERROR_TOO_LARGE = `The selected file must be smaller than ${MAX_FILE_SIZE_LABEL}`
const ERROR_FILENAME_TOO_LONG = `The file name must be ${MAX_FILENAME_LENGTH} characters or fewer`

const ERROR_CODES = Object.freeze({
  NO_FILE: 'NO_FILE',
  WRONG_EXTENSION: 'WRONG_EXTENSION',
  TOO_LARGE: 'TOO_LARGE',
  INVALID_FILENAME: 'INVALID_FILENAME',
  FILENAME_TOO_LONG: 'FILENAME_TOO_LONG'
})

const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.NO_FILE]: ERROR_NO_FILE,
  [ERROR_CODES.WRONG_EXTENSION]: ERROR_WRONG_EXTENSION,
  [ERROR_CODES.TOO_LARGE]: ERROR_TOO_LARGE,
  [ERROR_CODES.INVALID_FILENAME]: ERROR_INVALID_FILENAME,
  [ERROR_CODES.FILENAME_TOO_LONG]: ERROR_FILENAME_TOO_LONG
})

function toMessages(errorCodes) {
  return errorCodes.map((code) => ERROR_MESSAGES[code])
}

/**
 * @param {{ name: string, size: number } | null | undefined} file
 * @returns {string[]} machine-stable error codes, empty when valid
 */
export function validateFileCodes(file) {
  if (!file) {
    return [ERROR_CODES.NO_FILE]
  }
  const errors = []
  const hasAllowedExtension = file.name
    .toLowerCase()
    .endsWith(ALLOWED_EXTENSION)
  if (!hasAllowedExtension) {
    errors.push(ERROR_CODES.WRONG_EXTENSION)
  }
  if (hasAllowedExtension) {
    if (file.name.length > MAX_FILENAME_LENGTH) {
      errors.push(ERROR_CODES.FILENAME_TOO_LONG)
    } else if (!SAFE_FILENAME_RE.test(file.name)) {
      errors.push(ERROR_CODES.INVALID_FILENAME)
    }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(ERROR_CODES.TOO_LARGE)
  }
  return errors
}

/**
 * @param {{ name: string, size: number } | null | undefined} file
 * @returns {string[]} human-readable error messages, empty when valid
 */
export function validateFile(file) {
  return toMessages(validateFileCodes(file))
}

export {
  ALLOWED_EXTENSION,
  ERROR_CODES,
  ERROR_FILENAME_TOO_LONG,
  ERROR_INVALID_FILENAME,
  ERROR_NO_FILE,
  ERROR_TOO_LARGE,
  ERROR_WRONG_EXTENSION,
  MAX_FILE_SIZE_LABEL,
  MAX_FILENAME_LENGTH
}
