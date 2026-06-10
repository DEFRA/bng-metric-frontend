import { describe, test, expect } from 'vitest'

import { stripConditionPrefix } from './strip-condition-prefix.js'

describe('stripConditionPrefix', () => {
  test('strips a single-digit "N. " prefix', () => {
    expect(stripConditionPrefix('3. Moderate')).toBe('Moderate')
  })

  test('strips a double-digit "N. " prefix', () => {
    expect(stripConditionPrefix('10. Some Condition')).toBe('Some Condition')
  })

  test('returns the trimmed string unchanged when no prefix is present', () => {
    expect(stripConditionPrefix('  Moderate  ')).toBe('Moderate')
  })

  test('preserves null so absent conditions stay absent', () => {
    expect(stripConditionPrefix(null)).toBeNull()
  })

  test('preserves undefined so absent conditions stay absent', () => {
    expect(stripConditionPrefix(undefined)).toBeUndefined()
  })
})
