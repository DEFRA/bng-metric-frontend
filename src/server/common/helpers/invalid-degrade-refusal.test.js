import { describe, expect, test } from 'vitest'

import {
  DEGRADE_NOT_VALID_CODE,
  invalidDegradeErrors,
  isInvalidDegradeError
} from './invalid-degrade-refusal.js'

const UNPROCESSABLE = 422

const refusal = (payload = {}, statusCode = UNPROCESSABLE) => ({
  data: {
    res: { statusCode },
    payload: {
      code: DEGRADE_NOT_VALID_CODE,
      rule: 'degrade-worse-condition',
      ...payload
    }
  }
})

describe('#invalidDegradeErrors', () => {
  // The rule names the backend sends (edit-degrade-rule.js, DEGRADE_RULE).
  test.each([
    ['degrade-same-setting', 'habitatType'],
    ['degrade-worse-condition', 'condition'],
    ['degrade-advance-30-plus', 'advanceYears']
  ])('puts %s against %s', (rule, field) => {
    const errors = invalidDegradeErrors(refusal({ rule }))

    expect(Object.keys(errors)).toEqual([field])
    expect(errors[field].summary).toEqual(expect.any(String))
    expect(errors[field].inline).toEqual(expect.any(String))
  })

  // A rule the backend adds later is not one this page can place, so the
  // save fails as any other refused save does rather than blaming a field.
  test.each(['degrade-new-rule', 'constructor', 'toString', undefined])(
    'is null for a rule the page does not know (%s)',
    (rule) => {
      expect(invalidDegradeErrors(refusal({ rule }))).toBe(null)
    }
  )

  test.each([
    [
      'another code at the same status',
      refusal({ code: 'ENHANCEMENT_NOT_VALID' })
    ],
    ['the same code at another status', refusal({}, 400)],
    ['no backend response', new Error('network')]
  ])('is null for %s', (_, err) => {
    expect(isInvalidDegradeError(err)).toBe(false)
    expect(invalidDegradeErrors(err)).toBe(null)
  })
})
