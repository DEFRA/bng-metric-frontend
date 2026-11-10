import { describe, expect, test } from 'vitest'

import { MAX_FILE_SIZE_BYTES } from '../../server/common/constants.js'
import { CLIENT_FILE_ERROR_TEXT as MESSAGES } from '../../server/common/helpers/file-validation-messages.js'
import { MAX_FILENAME_LENGTH } from '../../shared/file-checks.js'
import {
  ERROR_CODES,
  validateFile as validateFileWith,
  validateFileCodes
} from './file-validation-rules.js'

// The messages the upload page hands the browser, from error-text.yaml.
const validateFile = (file) => validateFileWith(file, MESSAGES)
const ERROR_NO_FILE = MESSAGES[ERROR_CODES.NO_FILE]
const ERROR_WRONG_EXTENSION = MESSAGES[ERROR_CODES.WRONG_EXTENSION]
const ERROR_TOO_LARGE = MESSAGES[ERROR_CODES.TOO_LARGE]
const ERROR_INVALID_FILENAME = MESSAGES[ERROR_CODES.INVALID_FILENAME]
const ERROR_FILENAME_TOO_LONG = MESSAGES[ERROR_CODES.FILENAME_TOO_LONG]

describe('validateFile', () => {
  test("gives each check's message from the messages it is passed", () => {
    expect(MESSAGES).toEqual({
      NO_FILE: 'Select a GeoPackage (.gpkg) file',
      WRONG_EXTENSION: 'The selected file must be a GeoPackage (.gpkg)',
      TOO_LARGE: 'The selected file must be smaller than 100 MB',
      INVALID_FILENAME:
        'The file name can only include letters, numbers, spaces, hyphens, underscores, full stops or brackets',
      FILENAME_TOO_LONG: 'The file name must be 255 characters or fewer'
    })
    expect(validateFileWith(null, { NO_FILE: 'No file' })).toEqual(['No file'])
  })

  test('returns the no-file error when file is missing', () => {
    expect(validateFile(null)).toEqual([ERROR_NO_FILE])
    expect(validateFile(undefined)).toEqual([ERROR_NO_FILE])
  })

  test('accepts a .gpkg file under the size limit', () => {
    expect(validateFile({ name: 'baseline.gpkg', size: 1024 })).toEqual([])
  })

  test('treats the extension check as case-insensitive', () => {
    expect(validateFile({ name: 'BASELINE.GPKG', size: 1024 })).toEqual([])
  })

  test('flags a non-.gpkg extension', () => {
    expect(validateFile({ name: 'data.csv', size: 1024 })).toEqual([
      ERROR_WRONG_EXTENSION
    ])
  })

  test('flags a file at or above the size limit', () => {
    expect(
      validateFile({ name: 'big.gpkg', size: MAX_FILE_SIZE_BYTES + 1 })
    ).toEqual([ERROR_TOO_LARGE])
  })

  test('reports both extension and size errors together when both fail', () => {
    expect(
      validateFile({ name: 'big.csv', size: MAX_FILE_SIZE_BYTES + 1 })
    ).toEqual([ERROR_WRONG_EXTENSION, ERROR_TOO_LARGE])
  })

  test('accepts a file exactly at the limit', () => {
    expect(
      validateFile({ name: 'edge.gpkg', size: MAX_FILE_SIZE_BYTES })
    ).toEqual([])
  })

  test('accepts filenames with dots, hyphens, underscores, spaces and brackets', () => {
    expect(
      validateFile({ name: 'my survey_v2.0-final.gpkg', size: 1024 })
    ).toEqual([])
    expect(validateFile({ name: 'survey (1).gpkg', size: 1024 })).toEqual([])
  })

  test('accepts allowed punctuation as the first character', () => {
    expect(validateFile({ name: '(copy).gpkg', size: 1024 })).toEqual([])
    expect(validateFile({ name: '_draft.gpkg', size: 1024 })).toEqual([])
    expect(validateFile({ name: '-backup.gpkg', size: 1024 })).toEqual([])
    expect(validateFile({ name: '.hidden.gpkg', size: 1024 })).toEqual([])
    expect(validateFile({ name: ' leading-space.gpkg', size: 1024 })).toEqual(
      []
    )
  })

  test('rejects a filename with no letter or digit in the stem', () => {
    expect(validateFile({ name: '---.gpkg', size: 1024 })).toEqual([
      ERROR_INVALID_FILENAME
    ])
    expect(validateFile({ name: ' ().gpkg', size: 1024 })).toEqual([
      ERROR_INVALID_FILENAME
    ])
  })

  test.each([
    {
      description: 'apostrophe and SQL characters',
      name: "survey'; DROP TABLE projects; --.gpkg"
    },
    {
      description: 'path traversal sequences',
      name: '../../../etc/passwd.gpkg'
    },
    {
      description: 'newline',
      name: 'survey\n.gpkg'
    },
    {
      description: 'zero-width space',
      name: 'sur\u200Bvey.gpkg'
    },
    {
      description: 'RTL override character',
      name: 'survey\u202Egpkg.exe'
    }
  ])('rejects a filename with $description', ({ name }) => {
    const errors = validateFile({ name, size: 1024 })

    if (name.toLowerCase().endsWith('.gpkg')) {
      expect(errors).toEqual([ERROR_INVALID_FILENAME])
    } else {
      expect(errors).toEqual([ERROR_WRONG_EXTENSION])
    }
  })

  test('rejects a filename longer than 255 characters', () => {
    const name = `${'a'.repeat(MAX_FILENAME_LENGTH + 1 - '.gpkg'.length)}.gpkg`

    expect(validateFile({ name, size: 1024 })).toEqual([
      ERROR_FILENAME_TOO_LONG
    ])
    expect(name).toHaveLength(MAX_FILENAME_LENGTH + 1)
  })
})

describe('validateFileCodes', () => {
  test('returns a stable code for an invalid filename', () => {
    expect(validateFileCodes({ name: "survey'.gpkg", size: 1024 })).toEqual([
      ERROR_CODES.INVALID_FILENAME
    ])
  })
})
