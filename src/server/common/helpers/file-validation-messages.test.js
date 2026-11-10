import {
  CLIENT_FILE_ERROR_TEXT,
  FILE_ERROR_TEXT,
  uploadErrorText
} from './file-validation-messages.js'
import { FILE_CHECK_CODES } from '../../../shared/file-checks.js'

describe('uploadErrorText', () => {
  test("words a rule the session holds from error-text.yaml's forms.file", () => {
    expect(uploadErrorText('timedOut')).toBe(
      'The file check timed out. Please try again.'
    )
  })

  test('shows the words of a session from before the session held rules', () => {
    expect(uploadErrorText('The file check timed out. Please try again.')).toBe(
      'The file check timed out. Please try again.'
    )
  })
})

describe('CLIENT_FILE_ERROR_TEXT', () => {
  test("words every one of the browser's checks", () => {
    expect(Object.keys(CLIENT_FILE_ERROR_TEXT).sort()).toEqual(
      Object.values(FILE_CHECK_CODES).sort()
    )
  })

  test('fills in the limits', () => {
    expect(FILE_ERROR_TEXT.tooLarge).toBe(
      'The selected file must be smaller than 100 MB'
    )
    expect(FILE_ERROR_TEXT.nameTooLong).toBe(
      'The file name must be 255 characters or fewer'
    )
  })
})
