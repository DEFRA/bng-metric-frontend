import { describe, expect, test } from 'vitest'

import {
  isStoredValueRefusal,
  refusedFieldWords,
  storedFieldWords,
  storedValueRefusal
} from './stored-value-refusal.js'

const backendMessage = (fields) =>
  `This habitat holds a value saved before the service checked text lengths and lists (${fields}). Upload the file again, with the value corrected, to update it.`

const refusal = (message) => ({
  data: {
    res: { statusCode: 422 },
    payload: { code: 'STORED_VALUE_NOT_ALLOWED', message }
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

describe('refusedFieldWords', () => {
  test.each([
    ['ref', 'habitat reference'],
    ['ref, proposed.condition', 'habitat reference and proposed condition'],
    [
      'ref, proposed.condition, comment',
      'habitat reference, proposed condition and comment'
    ]
  ])('names %s as "%s"', (fields, words) => {
    expect(refusedFieldWords(backendMessage(fields))).toBe(words)
  })

  test('names a field once when two paths read the same', () => {
    expect(refusedFieldWords(backendMessage('0.ref, 1.ref'))).toBe(
      'habitat reference'
    )
  })

  test.each([['a message with no fields'], [undefined], [42]])(
    'falls back to "details" for %s',
    (message) => {
      expect(refusedFieldWords(message)).toBe('details')
    }
  )
})

describe('storedValueRefusal', () => {
  test('words the refusal from error-text.yaml, naming the fields', () => {
    expect(
      storedValueRefusal(refusal(backendMessage('ref, proposed.condition')))
    ).toEqual({
      summaryOnly:
        'This habitat holds a value saved before the service checked text lengths and lists, in its habitat reference and proposed condition. Upload the file again, with the value corrected, to update this habitat.'
    })
  })
})
