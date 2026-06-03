import { MAX_FILE_SIZE_BYTES } from '../../server/common/constants.js'

// Pure validators for the upload form. Kept DOM-free so the rules can be
// unit-tested with plain objects; the DOM shell that wires these into the
// page lives in file-upload-validation.js.

const ALLOWED_EXTENSION = '.gpkg'
const MAX_FILE_SIZE_LABEL = '100 MB'

const ERROR_NO_FILE = 'Select a GeoPackage (.gpkg) file'
const ERROR_WRONG_EXTENSION = 'The selected file must be a GeoPackage (.gpkg)'
const ERROR_TOO_LARGE = `The selected file must be smaller than ${MAX_FILE_SIZE_LABEL}`

/**
 * @param {{ name: string, size: number } | null | undefined} file
 * @returns {string[]} human-readable error messages, empty when valid
 */
export function validateFile(file) {
  if (!file) {
    return [ERROR_NO_FILE]
  }
  const errors = []
  if (!file.name.toLowerCase().endsWith(ALLOWED_EXTENSION)) {
    errors.push(ERROR_WRONG_EXTENSION)
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(ERROR_TOO_LARGE)
  }
  return errors
}

export {
  ALLOWED_EXTENSION,
  MAX_FILE_SIZE_LABEL,
  ERROR_NO_FILE,
  ERROR_WRONG_EXTENSION,
  ERROR_TOO_LARGE
}
