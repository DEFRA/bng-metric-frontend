import { describe, expect, test } from 'vitest'

import {
  DEGRADE_NOT_VALID_CODE,
  HABITAT_DEGRADE_NOT_VALID_CODE,
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
    ['degrade-worse-condition', 'condition'],
    ['degrade-advance-30-plus', 'advanceYears']
  ])('puts %s against %s', (rule, field) => {
    const errors = invalidDegradeErrors(refusal({ rule }))

    expect(Object.keys(errors)).toEqual([field])
    expect(errors[field].summary).toEqual(expect.any(String))
    expect(errors[field].inline).toEqual(expect.any(String))
  })

  // A tree planted in its place is Newly Planted; a habitat cleared and put
  // back gives a delay instead, so each code is worded for its own remedy.
  test.each([
    ['degrade-worse-condition', 'condition'],
    ['degrade-advance-30-plus', 'advanceYears']
  ])(
    'words a habitat’s %s against %s, with a delay as its remedy, not Newly Planted',
    (rule, field) => {
      const tree = invalidDegradeErrors(refusal({ rule }))
      const habitat = invalidDegradeErrors(
        refusal({ code: HABITAT_DEGRADE_NOT_VALID_CODE, rule })
      )

      expect(Object.keys(habitat)).toEqual([field])
      expect(habitat[field].inline).toMatch(/cleared and put back/)
      expect(habitat[field].inline).not.toMatch(/Newly Planted/)
      expect(tree[field].inline).toMatch(/Newly Planted/)
    }
  )

  // A rule the backend adds later is not one this page can place, so the
  // save fails as any other refused save does rather than blaming a field.
  test.each([
    'degrade-same-setting',
    'degrade-new-rule',
    'constructor',
    'toString',
    undefined
  ])('is null for a rule the page does not know (%s)', (rule) => {
    expect(invalidDegradeErrors(refusal({ rule }))).toBe(null)
  })

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
