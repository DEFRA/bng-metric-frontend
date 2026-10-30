import { describe, expect, test } from 'vitest'

import { isValidHabitatRef } from './habitat-ref.js'

describe('isValidHabitatRef', () => {
  test.each([
    ['a reference', 'B-A1'],
    ['a reference with surrounding spaces', '  B-A1  '],
    [
      'a reference over 100 characters, which the save truncates',
      'x'.repeat(150)
    ],
    ['non-Latin text', 'Ŵ-ŷ 1']
  ])('accepts %s', (_label, value) => {
    expect(isValidHabitatRef(value)).toBe(true)
  })

  test.each([
    ['an empty value', ''],
    ['whitespace only', ' \t '],
    ['a missing value', undefined],
    ['a null value', null],
    ['a replacement character from invalid UTF-8', 'B-A\uFFFD'],
    ['a lone surrogate', 'B-A\uD800']
  ])('refuses %s', (_label, value) => {
    expect(isValidHabitatRef(value)).toBe(false)
  })
})
