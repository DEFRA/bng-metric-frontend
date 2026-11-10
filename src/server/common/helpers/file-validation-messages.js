import { formErrorText } from '../error-text/error-text.js'
import {
  FILE_CHECK_CODES,
  MAX_FILENAME_LENGTH,
  MAX_FILE_SIZE_LABEL
} from '../../../shared/file-checks.js'

// The upload page's messages about the file, from error-text.yaml's forms.file.
// Each shows the same words in the error summary and against the file input.
const message = (rule, values) => formErrorText('file', rule, values).inline

/** By rule: what the session stores, between the check and the upload page. */
export const FILE_ERROR_TEXT = Object.freeze({
  noFile: message('noFile'),
  notAGeoPackage: message('notAGeoPackage'),
  tooLarge: message('tooLarge', { max: MAX_FILE_SIZE_LABEL }),
  invalidName: message('invalidName'),
  nameTooLong: message('nameTooLong', { max: MAX_FILENAME_LENGTH }),
  serviceBusy: message('serviceBusy'),
  timedOut: message('timedOut')
})

/**
 * By check code, for the browser's own checks: the upload page hands these to
 * file-upload-validation.js, which cannot read error-text.yaml itself.
 */
export const CLIENT_FILE_ERROR_TEXT = Object.freeze({
  [FILE_CHECK_CODES.NO_FILE]: FILE_ERROR_TEXT.noFile,
  [FILE_CHECK_CODES.WRONG_EXTENSION]: FILE_ERROR_TEXT.notAGeoPackage,
  [FILE_CHECK_CODES.TOO_LARGE]: FILE_ERROR_TEXT.tooLarge,
  [FILE_CHECK_CODES.INVALID_FILENAME]: FILE_ERROR_TEXT.invalidName,
  [FILE_CHECK_CODES.FILENAME_TOO_LONG]: FILE_ERROR_TEXT.nameTooLong
})

export const ERROR_INVALID_FILENAME = FILE_ERROR_TEXT.invalidName
export const ERROR_FILENAME_TOO_LONG = FILE_ERROR_TEXT.nameTooLong

/**
 * The upload page's message for what the session holds: a rule of
 * FILE_ERROR_TEXT, or, in a session from before the session held rules, the
 * message itself.
 *
 * @param {string} stored
 * @returns {string}
 */
export function uploadErrorText(stored) {
  return Object.hasOwn(FILE_ERROR_TEXT, stored)
    ? FILE_ERROR_TEXT[stored]
    : stored
}
