import { describe, expect, test } from 'vitest'

import {
  habitatRefFormFields,
  isRefUnchanged,
  isValidHabitatRef,
  storedRefText
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
