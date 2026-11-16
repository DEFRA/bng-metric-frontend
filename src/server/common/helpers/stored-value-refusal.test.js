import { describe, expect, test } from 'vitest'

import {
  isStoredValueRefusal,
  refusedFieldWords,
  refusedPaths,
  storedFieldWords,
  storedValueRefusal
} from './stored-value-refusal.js'

const backendMessage = (fields) =>
  `This habitat holds a value saved before the service checked text lengths and lists (${fields}). Upload the file again, with the value corrected, to update it.`

const refusal = (message, fields) => ({
  data: {
    res: { statusCode: 422 },
    payload: {
      code: 'STORED_VALUE_NOT_ALLOWED',
      message,
      ...(fields && { fields })
    }
  }
})

describe('isStoredValueRefusal', () => {
  test('is true for the backend’s STORED_VALUE_NOT_ALLOWED refusal', () => {
    expect(isStoredValueRefusal(refusal(backendMessage('ref')))).toBe(true)
  })

  test.each([
    [
      'another 422',
      { data: { res: { statusCode: 422 }, payload: { code: 'OTHER' } } }
    ],
    [
      'the code with another status',
      {
        data: {
          res: { statusCode: 400 },
          payload: { code: 'STORED_VALUE_NOT_ALLOWED' }
        }
      }
    ],
    ['no error', undefined]
  ])('is false for %s', (_label, err) => {
    expect(isStoredValueRefusal(err)).toBe(false)
  })
})

describe('storedFieldWords', () => {
  test.each([
    ['ref', 'habitat reference'],
    ['condition', 'condition'],
    ['proposed.condition', 'proposed condition'],
    ['baseline.condition', 'baseline condition'],
    ['watercourseEncroachment', 'encroachment into watercourse'],
    [
      'proposed.riparianEncroachment',
      'proposed encroachment into riparian zone'
    ],
    ['broadType', 'broad habitat'],
    ['retentionCategory', 'retention category'],
    ['strategicSignificance', 'strategic significance'],
    ['comment', 'comment'],
    ['location', 'location'],
    ['spatialRiskCategory', 'spatial risk category'],
    ['0.proposed.treeSize', 'proposed tree size'],
    ['proposed.treeSpecies', 'proposed tree type']
  ])('says %s as "%s"', (path, words) => {
    expect(storedFieldWords(path)).toBe(words)
  })

  test.each([['notAField'], ['other.condition'], ['a.b.condition']])(
    'gives the path itself for %s, which it does not know',
    (path) => {
      expect(storedFieldWords(path)).toBe(path)
    }
  )
})

describe('refusedPaths', () => {
  test('reads the fields the backend names in its payload', () => {
    expect(
      refusedPaths({
        message: backendMessage('not, these'),
        fields: ['ref', 'proposed.condition']
      })
    ).toEqual(['ref', 'proposed.condition'])
  })

  test('reads them from the message of an older backend, which sends no fields', () => {
    expect(
      refusedPaths({ message: backendMessage('ref, proposed.condition') })
    ).toEqual(['ref', 'proposed.condition'])
  })

  test.each([
    [{ message: 'a message with no fields' }],
    [{ message: 42 }],
    [undefined],
    [{ fields: [null, '', 7] }]
  ])('finds none in %j', (payload) => {
    expect(refusedPaths(payload)).toEqual([])
  })
})

describe('refusedFieldWords', () => {
  test.each([
    [['ref'], 'habitat reference'],
    [['ref', 'proposed.condition'], 'habitat reference and proposed condition'],
    [
      ['ref', 'proposed.condition', 'comment'],
      'habitat reference, proposed condition and comment'
    ]
  ])('names %j as "%s"', (paths, words) => {
    expect(refusedFieldWords(paths)).toBe(words)
  })

  test('names a field once when two paths read the same', () => {
    expect(refusedFieldWords(['0.ref', '1.ref'])).toBe('habitat reference')
  })

  test('falls back to "details" when there are none', () => {
    expect(refusedFieldWords([])).toBe('details')
  })
})

describe('storedValueRefusal', () => {
  const refTooLong = { summary: 'Too long.', inline: 'Shorten it.' }

  test('words the refusal from error-text.yaml, naming the fields', () => {
    expect(
      storedValueRefusal(refusal('not read', ['ref', 'proposed.condition']), {
        refTooLong
      })
    ).toEqual({
      summaryOnly:
        'This habitat holds a value saved before the service checked text lengths and lists, in its habitat reference and proposed condition. Upload the file again, with the value corrected, to update this habitat.'
    })
  })

  test('names the fields in the message of an older backend', () => {
    expect(
      storedValueRefusal(refusal(backendMessage('comment'))).summaryOnly
    ).toContain('in its comment.')
  })

  test('gives the page its reference error when the reference alone is refused', () => {
    expect(
      storedValueRefusal(refusal('not read', ['ref']), { refTooLong })
    ).toBe(refTooLong)
  })

  test('words a refused reference alone as a page-level error on a page that cannot edit it', () => {
    expect(
      storedValueRefusal(refusal('not read', ['ref'])).summaryOnly
    ).toContain('in its habitat reference.')
  })
})
