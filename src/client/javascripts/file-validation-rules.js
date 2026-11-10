import { MAX_FILE_SIZE_BYTES } from '../../server/common/constants.js'
import {
  FILE_CHECK_CODES,
  MAX_FILENAME_LENGTH,
  MAX_FILE_SIZE_LABEL
} from '../../shared/file-checks.js'

// Pure validators for the upload form. Kept DOM-free so the rules can be
// unit-tested with plain objects; the DOM shell that wires these into the
// page lives in file-upload-validation.js. The words come from the page, which
// has them from error-text.yaml, so they are passed in.

const ALLOWED_EXTENSION = '.gpkg'
// Same whitelist as the backend. Leading punctuation is allowed, but the stem
// must include at least one letter or digit so names like `..gpkg` are rejected.
const SAFE_FILENAME_RE = /^[ ._()-]*[a-z0-9][a-z0-9 ._()-]*\.gpkg$/i

const ERROR_CODES = FILE_CHECK_CODES

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
  } else if (file.name.length > MAX_FILENAME_LENGTH) {
    errors.push(ERROR_CODES.FILENAME_TOO_LONG)
  } else if (!SAFE_FILENAME_RE.test(file.name)) {
    errors.push(ERROR_CODES.INVALID_FILENAME)
  } else {
    // Filename is valid — no filename error to record
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(ERROR_CODES.TOO_LARGE)
  }
  return errors
}

/**
 * @param {{ name: string, size: number } | null | undefined} file
 * @param {Record<string, string>} messages - each check code's message
 * @returns {string[]} human-readable error messages, empty when valid
 */
export function validateFile(file, messages) {
  return validateFileCodes(file).map((code) => messages[code])
}

export {
  ALLOWED_EXTENSION,
  ERROR_CODES,
  MAX_FILE_SIZE_LABEL,
  MAX_FILENAME_LENGTH
}
