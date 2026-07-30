import { describe, test, expect } from 'vitest'

import {
  formatAreaHectares,
  formatAreaHectaresValue,
  formatHabitatUnits,
  formatLengthKm,
  formatTotalAreaSize,
  formatTotalLengthSize
} from './format-habitat-values.js'

describe('formatAreaHectares', () => {
  test('Converts whole square metres to hectares and appends "ha"', () => {
    expect(formatAreaHectares(10000)).toBe('1ha')
    expect(formatAreaHectares(25000)).toBe('2.5ha')
  })

  test('Rounds to 10 significant figures (trailing zeros stripped)', () => {
    // 1.234567894e9 m² → 123456.7894 hectares (already 10 sig figs)
    expect(formatAreaHectares(1234567894)).toBe('123456.7894ha')
    // 11 sig figs in the source — rounded to 10
    expect(formatAreaHectares(12345678945)).toBe('1234567.894ha')
  })

  test('Handles small areas without scientific notation oddities', () => {
    expect(formatAreaHectares(1)).toBe('0.0001ha')
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

describe('formatAreaHectaresValue', () => {
  test('Converts square metres to hectares with no unit suffix', () => {
    expect(formatAreaHectaresValue(10000)).toBe('1')
    expect(formatAreaHectaresValue(25000)).toBe('2.5')
  })

  test('Rounds to 10 significant figures', () => {
    expect(formatAreaHectaresValue(12345678945)).toBe('1234567.894')
  })

  test('Returns empty string for null, undefined or non-finite input', () => {
    expect(formatAreaHectaresValue(null)).toBe('')
    expect(formatAreaHectaresValue(undefined)).toBe('')
    expect(formatAreaHectaresValue(Number.NaN)).toBe('')
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

describe('formatLengthKm', () => {
  test('Converts metres to kilometres', () => {
    expect(formatLengthKm(1000)).toBe('1')
    expect(formatLengthKm(2500)).toBe('2.5')
  })

  test('Rounds to 7 significant figures (trailing zeros stripped)', () => {
    expect(formatLengthKm(1234567.891)).toBe('1234.568')
  })

  test('Handles small lengths', () => {
    expect(formatLengthKm(1)).toBe('0.001')
  })

  test('Returns empty string for null, undefined or non-finite input', () => {
    expect(formatLengthKm(null)).toBe('')
    expect(formatLengthKm(undefined)).toBe('')
    expect(formatLengthKm(Number.NaN)).toBe('')
    expect(formatLengthKm(Number.POSITIVE_INFINITY)).toBe('')
  })

  test('Returns empty string when given a non-number', () => {
    expect(formatLengthKm('100')).toBe('')
  })
})

describe('formatTotalAreaSize', () => {
  test('Converts square metres to hectares and appends "ha" with no space', () => {
    expect(formatTotalAreaSize(10000)).toBe('1ha')
    expect(formatTotalAreaSize(25000)).toBe('2.5ha')
  })

  test('Rounds to 10 significant figures', () => {
    expect(formatTotalAreaSize(12345678945)).toBe('1234567.894ha')
  })

  test('Handles small areas', () => {
    expect(formatTotalAreaSize(1)).toBe('0.0001ha')
  })

  test('Returns empty string for null, undefined or non-finite input', () => {
    expect(formatTotalAreaSize(null)).toBe('')
    expect(formatTotalAreaSize(undefined)).toBe('')
    expect(formatTotalAreaSize(Number.NaN)).toBe('')
    expect(formatTotalAreaSize(Number.POSITIVE_INFINITY)).toBe('')
  })

  test('Returns empty string when given a non-number', () => {
    expect(formatTotalAreaSize('100')).toBe('')
  })
})

describe('formatTotalLengthSize', () => {
  test('Converts metres to kilometres and appends "km" with no space', () => {
    expect(formatTotalLengthSize(1000)).toBe('1km')
    expect(formatTotalLengthSize(2500)).toBe('2.5km')
  })

  test('Rounds to 7 significant figures', () => {
    // 1234567.891 m → 1234.567891 km → 7 sig figs → 1234.568 km
    expect(formatTotalLengthSize(1234567.891)).toBe('1234.568km')
  })

  test('Returns "No data" when the total is zero', () => {
    expect(formatTotalLengthSize(0)).toBe('No data')
  })

  test('Returns "No data" for null, undefined or non-finite input', () => {
    expect(formatTotalLengthSize(null)).toBe('No data')
    expect(formatTotalLengthSize(undefined)).toBe('No data')
    expect(formatTotalLengthSize(Number.NaN)).toBe('No data')
    expect(formatTotalLengthSize(Number.POSITIVE_INFINITY)).toBe('No data')
  })

  test('Returns "No data" when given a non-number', () => {
    expect(formatTotalLengthSize('100')).toBe('No data')
  })
})
