import { describe, expect, test } from 'vitest'

import { HABITAT_REF_ERRORS, habitatRefError } from './habitat-ref.js'

describe('habitatRefError', () => {
  test.each([
    ['a reference', 'B-A1'],
    ['a reference with surrounding spaces', '  B-A1  '],
    [
      'a reference over 100 characters, which the save truncates',
      'x'.repeat(150)
    ],
    ['non-Latin text', 'Ŵ-ŷ 1']
  ])('accepts %s', (_label, value) => {
    expect(habitatRefError(value)).toBeNull()
  })

  test.each([
    ['an empty value', ''],
    ['whitespace only', ' \t '],
    ['a missing value', undefined],
    ['a null value', null]
  ])('asks for a reference given %s', (_label, value) => {
    expect(habitatRefError(value)).toBe(HABITAT_REF_ERRORS.missing)
  })

  test.each([
    ['a replacement character from invalid UTF-8', 'B-A�'],
    ['a lone surrogate', 'B-A\uD800']
  ])('refuses %s', (_label, value) => {
    expect(habitatRefError(value)).toBe(HABITAT_REF_ERRORS.invalidCharacters)
  })
})
