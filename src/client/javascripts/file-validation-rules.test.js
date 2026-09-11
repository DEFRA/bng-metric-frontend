import { describe, expect, test } from 'vitest'

import { MAX_FILE_SIZE_BYTES } from '../../server/common/constants.js'
import {
  ERROR_CODES,
  ERROR_FILENAME_TOO_LONG,
  ERROR_INVALID_FILENAME,
  ERROR_NO_FILE,
  ERROR_TOO_LARGE,
  ERROR_WRONG_EXTENSION,
  MAX_FILENAME_LENGTH,
  validateFile,
  validateFileCodes
} from './file-validation-rules.js'

describe('validateFile', () => {
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
