import { describe, test, expect } from 'vitest'

import {
  formatAreaHectares,
  formatHabitatUnits
} from './format-habitat-values.js'

describe('formatAreaHectares', () => {
  test('Converts whole square metres to hectares', () => {
    expect(formatAreaHectares(10000)).toBe('1')
    expect(formatAreaHectares(25000)).toBe('2.5')
  })

  test('Rounds to 10 significant figures (trailing zeros stripped)', () => {
    // 1.234567894e9 m² → 123456.7894 hectares (already 10 sig figs)
    expect(formatAreaHectares(1234567894)).toBe('123456.7894')
    // 11 sig figs in the source — rounded to 10
    expect(formatAreaHectares(12345678945)).toBe('1234567.894')
  })

  test('Handles small areas without scientific notation oddities', () => {
    expect(formatAreaHectares(1)).toBe('0.0001')
  })

  test('Returns empty string for null, undefined or non-finite input', () => {
    expect(formatAreaHectares(null)).toBe('')
    expect(formatAreaHectares(undefined)).toBe('')
    expect(formatAreaHectares(Number.NaN)).toBe('')
    expect(formatAreaHectares(Number.POSITIVE_INFINITY)).toBe('')
  })

  test('Returns empty string when given a non-number', () => {
    expect(formatAreaHectares('100')).toBe('')
  })
})

describe('formatHabitatUnits', () => {
  test('Formats to 2 decimal places', () => {
    expect(formatHabitatUnits(1)).toBe('1.00')
    expect(formatHabitatUnits(2.5)).toBe('2.50')
    expect(formatHabitatUnits(0.001)).toBe('0.00')
  })

  test('Caps total significant figures at 7', () => {
    // 1234567.891 has 10 sig figs; cap → 1234568 → toFixed(2) → '1234568.00'
    expect(formatHabitatUnits(1234567.891)).toBe('1234568.00')
  })

  test('Returns empty string for null, undefined or non-finite input', () => {
    expect(formatHabitatUnits(null)).toBe('')
    expect(formatHabitatUnits(undefined)).toBe('')
    expect(formatHabitatUnits(Number.NaN)).toBe('')
  })
})
