// The upload page's checks of a chosen file, shared by the server, which words
// each one from error-text.yaml, and the browser, which makes them before the
// file is sent.

export const MAX_FILENAME_LENGTH = 255
export const MAX_FILE_SIZE_LABEL = '100 MB'

/** Each check's code. The backend sends the two file name codes too. */
export const FILE_CHECK_CODES = Object.freeze({
  NO_FILE: 'NO_FILE',
  WRONG_EXTENSION: 'WRONG_EXTENSION',
  TOO_LARGE: 'TOO_LARGE',
  INVALID_FILENAME: 'INVALID_FILENAME',
  FILENAME_TOO_LONG: 'FILENAME_TOO_LONG'
})
