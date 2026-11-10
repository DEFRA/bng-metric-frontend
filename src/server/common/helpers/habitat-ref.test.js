import { describe, expect, test } from 'vitest'

import {
  HABITAT_REF_ERROR,
  HABITAT_REF_TOO_LONG_ERROR,
  habitatRefFormFields,
  habitatRefRefusal,
  isHabitatRefTooLong,
  isRefInUseError,
  isRefUnchanged,
  isValidHabitatRef,
  storedRefText
} from './habitat-ref.js'

describe('isValidHabitatRef', () => {
  test.each([
    ['a reference', 'B-A1'],
    ['a reference with surrounding spaces', '  B-A1  '],
    [
      'a reference over 99 characters, whose length habitatRefRefusal checks',
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

describe('isHabitatRefTooLong', () => {
  test.each([
    ['99 characters', 'x'.repeat(99)],
    ['99 characters with surrounding spaces', `  ${'x'.repeat(99)}  `],
    [
      '99 characters outside the Basic Multilingual Plane',
      '\u{1F33F}'.repeat(99)
    ],
    ['a value that is not text', undefined]
  ])('is false for %s', (_label, value) => {
    expect(isHabitatRefTooLong(value)).toBe(false)
  })

  test('is true for 100 characters', () => {
    expect(isHabitatRefTooLong('x'.repeat(100))).toBe(true)
  })
})

describe('habitatRefRefusal', () => {
  test.each([
    ['a valid reference', 'B-A1', null],
    ['a blank reference', ' ', HABITAT_REF_ERROR],
    [
      'a reference over 99 characters',
      'x'.repeat(100),
      HABITAT_REF_TOO_LONG_ERROR
    ],
    [
      'an over-long reference that is not UTF-8',
      `${'x'.repeat(100)}\uFFFD`,
      HABITAT_REF_ERROR
    ]
  ])('answers for %s', (_label, value, expected) => {
    expect(habitatRefRefusal(value)).toBe(expected)
  })

  test('asks the user to shorten a reference that is too long', () => {
    expect(HABITAT_REF_TOO_LONG_ERROR).toEqual({
      summary: 'Enter a habitat reference of 99 characters or fewer.',
      inline: 'Enter a habitat reference of 99 characters or fewer.'
    })
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
        maxLength: 99
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
        maxLength: 99
      }
    })
  })

  test('shows a refusal no one field can put right in the error summary only, keeping what was typed', () => {
    expect(
      habitatRefFormFields({
        heading: 'Habitat A1',
        savedRef: 'A1',
        submittedRef: 'A2',
        refusal: { summaryOnly: 'Upload the file again.' }
      })
    ).toEqual({
      pageTitle: 'Error: Habitat A1',
      errors: [{ text: 'Upload the file again.' }],
      habitatRefInput: {
        id: 'habitatRef',
        value: 'A2',
        error: undefined,
        maxLength: 99
      }
    })
  })
})

describe('storedRefText', () => {
  test.each([
    ['A1', 'A1'],
    [12, '12'],
    [null, ''],
    [undefined, '']
  ])('shows %s as "%s"', (ref, expected) => {
    expect(storedRefText(ref)).toBe(expected)
  })
})

describe('isRefUnchanged', () => {
  test.each([
    ['the same text', 'A1', 'A1'],
    ['a number stored', '12', 12],
    ['surrounding spaces kept', ' A1 ', ' A1 '],
    ['a trailing line break the input dropped', 'A1', 'A1\n'],
    ['an embedded line break the input dropped', 'A1', 'A\r\n1'],
    ['nothing stored and nothing typed', '', null],
    ['nothing stored and only spaces typed', '   ', undefined],
    ['a stored line break alone', '', '\n']
  ])('is true for %s', (_label, submitted, stored) => {
    expect(isRefUnchanged(submitted, stored)).toBe(true)
  })

  test.each([
    ['a new reference', 'A2', 'A1'],
    ['a reference blanked', '', 'A1'],
    ['spaces added', ' A1 ', 'A1']
  ])('is false for %s', (_label, submitted, stored) => {
    expect(isRefUnchanged(submitted, stored)).toBe(false)
  })
})
