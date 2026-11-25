import { validateProjectDetailsForm, validateSurveyDate } from './validation.js'

// 23:30 on 1 July 2026 in London (BST).
const TODAY = new Date('2026-07-01T22:30:00Z')

describe('validateSurveyDate', () => {
  test('treats all three boxes left blank as no date', () => {
    expect(validateSurveyDate({ day: '', month: '', year: '' }, TODAY)).toEqual(
      { value: null }
    )
  })

  test('pads a valid date to DD/MM/YYYY', () => {
    expect(
      validateSurveyDate({ day: '3', month: '7', year: '2025' }, TODAY)
    ).toEqual({ value: '03/07/2025' })
  })

  test("accepts today's date in the UK", () => {
    expect(
      validateSurveyDate({ day: '1', month: '7', year: '2026' }, TODAY)
    ).toEqual({ value: '01/07/2026' })
  })

  test('refuses the day after today in the UK, even when the server is in UTC', () => {
    const late = new Date('2026-07-01T23:30:00Z') // 00:30 on 2 July in London
    expect(
      validateSurveyDate({ day: '2', month: '7', year: '2026' }, late)
    ).toEqual({ value: '02/07/2026' })
    expect(
      validateSurveyDate({ day: '3', month: '7', year: '2026' }, late).error
        .text
    ).toBe('Survey date must be today or in the past')
  })

  test('refuses a part missing before checking the others are numbers', () => {
    const { error } = validateSurveyDate(
      { day: 'x', month: '', year: '2025' },
      TODAY
    )
    expect(error).toMatchObject({
      text: 'Survey date must include a month',
      parts: ['month'],
      href: '#surveyCompletionDate-month'
    })
  })

  test('highlights only the parts that are not numbers', () => {
    const { error } = validateSurveyDate(
      { day: '1', month: 'June', year: '20x5' },
      TODAY
    )
    expect(error).toMatchObject({
      text: 'Survey date must only include numbers',
      parts: ['month', 'year']
    })
  })

  test.each([
    { day: '31', month: '2', year: '2025' },
    { day: '1', month: '13', year: '2025' },
    { day: '1', month: '1', year: '25' }
  ])('refuses %j as not a real date', (parts) => {
    expect(validateSurveyDate(parts, TODAY).error.text).toBe(
      'Survey date must be a real date'
    )
  })
})

describe('validateProjectDetailsForm', () => {
  test('returns the name apart from the details', () => {
    const result = validateProjectDetailsForm(
      {
        projectName: ' A project ',
        surveyCompleters: '',
        returnUrl: '/projects/x/area-summary'
      },
      TODAY
    )
    expect(result).toEqual({
      errors: [],
      name: 'A project',
      details: {
        surveyCompleters: null,
        surveyCompletionDate: null,
        applicant: null,
        localPlanningAuthorityReference: null,
        planningApplicationReference: null,
        planningApplicationType: null
      }
    })
  })

  test('checks the survey date even when another field fails', () => {
    const { errors } = validateProjectDetailsForm(
      {
        projectName: '',
        'surveyCompletionDate-day': '1',
        'surveyCompletionDate-month': '1',
        'surveyCompletionDate-year': '2999',
        planningApplicationType: 'a'.repeat(101)
      },
      TODAY
    )
    expect(errors.map((error) => error.name)).toEqual([
      'projectName',
      'surveyCompletionDate',
      'planningApplicationType'
    ])
  })

  test.each([
    'surveyCompleters',
    'applicant',
    'planningApplicationReference',
    'planningApplicationType'
  ])('refuses an invalid character in %s', (field) => {
    const { errors } = validateProjectDetailsForm(
      { projectName: 'A project', [field]: 'tab\there' },
      TODAY
    )
    expect(errors).toEqual([
      expect.objectContaining({
        name: field,
        text: expect.stringContaining('must only contain valid characters')
      })
    ])
  })
})
