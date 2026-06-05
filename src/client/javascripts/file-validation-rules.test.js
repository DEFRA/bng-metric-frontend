import { describe, expect, test } from 'vitest'

import { MAX_FILE_SIZE_BYTES } from '../../server/common/constants.js'
import {
  ERROR_NO_FILE,
  ERROR_TOO_LARGE,
  ERROR_WRONG_EXTENSION,
  validateFile
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
})
