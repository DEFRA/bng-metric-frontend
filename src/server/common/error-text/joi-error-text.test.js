import Joi from 'joi'

import { joiErrorText, joiMessages } from './joi-error-text.js'

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }))
vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockWarn })
}))

const firstDetail = (schema, value) =>
  schema.validate(value, { abortEarly: false }).error.details[0]

describe('joiMessages', () => {
  test("maps each Joi error type to a forms rule's words, filled in", () => {
    expect(
      joiMessages('projectName', {
        'any.required': 'required',
        'string.max': ['tooLong', { max: 3 }]
      })
    ).toEqual({
      'any.required': 'Enter a project name',
      'string.max': 'Project name must be 3 characters or fewer'
    })
  })

  test('throws for a rule error-text.yaml does not word', () => {
    expect(() =>
      joiMessages('projectName', { 'any.required': 'nope' })
    ).toThrow(/no forms\.projectName\.nope/)
  })
})

describe('joiErrorText', () => {
  beforeEach(() => mockWarn.mockClear())

  test("gives a schema's own message", () => {
    const schema = Joi.object({
      name: Joi.string()
        .max(3)
        .messages(
          joiMessages('projectName', { 'string.max': ['tooLong', { max: 3 }] })
        )
    })
    expect(joiErrorText(firstDetail(schema, { name: 'long' }))).toBe(
      'Project name must be 3 characters or fewer'
    )
    expect(mockWarn).not.toHaveBeenCalled()
  })

  test("keeps Joi's own wording off the page, and logs the gap", () => {
    const schema = Joi.object({ applicant: Joi.string().max(3) })
    expect(joiErrorText(firstDetail(schema, { applicant: 'long' }))).toBe(
      'There is a problem with this answer'
    )
    expect(mockWarn).toHaveBeenCalledWith(
      'No error-text.yaml rule for string.max on applicant'
    )
  })
})
