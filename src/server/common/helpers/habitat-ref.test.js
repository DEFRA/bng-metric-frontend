import { describe, expect, test } from 'vitest'

import {
  habitatRefFormFields,
  isRefInUseError,
  isValidHabitatRef
} from './habitat-ref.js'

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

describe('isRefInUseError', () => {
  test('is true for the backend’s HABITAT_REF_IN_USE refusal', () => {
    expect(
      isRefInUseError({
        data: {
          res: { statusCode: 422 },
          payload: { code: 'HABITAT_REF_IN_USE' }
        }
      })
    ).toBe(true)
  })

  test.each([
    ['another 422', { data: { res: { statusCode: 422 }, payload: {} } }],
    [
      'the code on another status',
      {
        data: {
          res: { statusCode: 400 },
          payload: { code: 'HABITAT_REF_IN_USE' }
        }
      }
    ],
    ['an error with no response', new Error('socket hang up')]
  ])('is false for %s', (_label, err) => {
    expect(isRefInUseError(err)).toBe(false)
  })
})

describe('habitatRefFormFields', () => {
  test('shows the saved reference, with no error', () => {
    expect(
      habitatRefFormFields({ heading: 'Habitat A1', savedRef: 12 })
    ).toEqual({
      pageTitle: 'Habitat A1',
      errors: [],
      habitatRefInput: {
        id: 'habitatRef',
        value: '12',
        error: undefined,
        maxLength: 100
      }
    })
  })

  test('shows an empty input for a habitat with no saved reference', () => {
    expect(
      habitatRefFormFields({ heading: 'Habitat', savedRef: null })
        .habitatRefInput.value
    ).toBe('')
  })

  test('shows what was typed, and the refusal, when a save is refused', () => {
    expect(
      habitatRefFormFields({
        heading: 'Habitat A1',
        savedRef: 'A1',
        submittedRef: ' ',
        refusal: { summary: 'Summary.', inline: 'Inline.' }
      })
    ).toEqual({
      pageTitle: 'Error: Habitat A1',
      errors: [{ text: 'Summary.', href: '#habitatRef' }],
      habitatRefInput: {
        id: 'habitatRef',
        value: ' ',
        error: { text: 'Inline.' },
        maxLength: 100
      }
    })
  })
})
