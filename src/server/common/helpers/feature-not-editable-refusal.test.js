import { describe, expect, test } from 'vitest'

import {
  FEATURE_NOT_EDITABLE_CODE,
  featureNotEditableRefusal,
  isFeatureNotEditableError
} from './feature-not-editable-refusal.js'

const BAD_REQUEST = 400

const refusal = (overrides = {}) => ({
  isBoom: true,
  output: { statusCode: BAD_REQUEST },
  data: {
    res: { statusCode: BAD_REQUEST },
    payload: { code: FEATURE_NOT_EDITABLE_CODE }
  },
  ...overrides
})

describe('#isFeatureNotEditableError', () => {
  test('recognises the backend refusal by its status and code', () => {
    expect(isFeatureNotEditableError(refusal())).toBe(true)
  })

  // The refusal shares its status with a refused reference, so the code is
  // what tells them apart: a bare 400 must not be taken for this one.
  test.each([
    ['a bare 400, as a refused reference gets', { data: undefined }],
    [
      'a 400 carrying another code',
      { data: { res: { statusCode: BAD_REQUEST }, payload: { code: 'OTHER' } } }
    ],
    [
      'the same code on another status',
      {
        output: { statusCode: 422 },
        data: {
          res: { statusCode: 422 },
          payload: { code: FEATURE_NOT_EDITABLE_CODE }
        }
      }
    ]
  ])('does not recognise %s', (_what, overrides) => {
    expect(isFeatureNotEditableError(refusal(overrides))).toBe(false)
  })

  test.each([undefined, null, {}, new Error('boom')])(
    'does not recognise %j',
    (err) => {
      expect(isFeatureNotEditableError(err)).toBe(false)
    }
  )
})

describe('#featureNotEditableRefusal', () => {
  // summaryOnly, not a { summary, inline } pair: no field the page can edit is
  // to blame, so the error summary links to nothing.
  test('is a page-level error, with no field to link to', () => {
    const wording = featureNotEditableRefusal()

    expect(wording.summaryOnly).toContain('cannot be changed in that way')
    expect(wording.summary).toBeUndefined()
    expect(wording.inline).toBeUndefined()
  })
})
