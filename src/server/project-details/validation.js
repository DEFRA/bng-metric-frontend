import Joi from 'joi'

import { formErrorText } from '../common/error-text/error-text.js'
import {
  joiErrorText,
  joiMessages
} from '../common/error-text/joi-error-text.js'
import { projectNameSchema } from '../common/helpers/project-name.js'
import { validCharacters } from '../common/helpers/valid-characters.js'
import {
  MAX_PERSON_NAME_LENGTH,
  MAX_PLANNING_APPLICATION_REFERENCE_LENGTH,
  MAX_PLANNING_APPLICATION_TYPE_LENGTH
} from './constants.js'

export const DATE_FIELD = 'surveyCompletionDate'
export const DAY_KEY = `${DATE_FIELD}-day`
export const MONTH_KEY = `${DATE_FIELD}-month`
export const YEAR_KEY = `${DATE_FIELD}-year`
const DATE_PART_NAMES = ['day', 'month', 'year']
const YEAR_DIGIT_LENGTH = 4
const DIGITS_PATTERN = /^\d+$/
const DATE_PAD_LENGTH = 2

// The page's fields, in the order it shows them: the error summary lists its
// problems in this order too.
export const FIELD_ORDER = [
  'projectName',
  'surveyCompleters',
  DATE_FIELD,
  'applicant',
  'localPlanningAuthorityReference',
  'planningApplicationReference',
  'planningApplicationType'
]

// The fields saved under project.details: all but the project name, which
// the project holds itself.
const DETAIL_FIELDS = FIELD_ORDER.filter(
  (field) => field !== 'projectName' && field !== DATE_FIELD
)

// "Today" for the survey date is the UK's, whatever the server's clock zone.
const UK_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' })

/**
 * An optional free-text field: trimmed, blank saved as null so a field the
 * user clears is cleared (the backend merges the details it is sent, so a
 * field left out would keep its old value), and refused over `max` or with a
 * character that is not valid UTF-8.
 */
function optionalText(field, max) {
  return Joi.string()
    .trim()
    .empty('')
    .allow(null)
    .default(null)
    .max(max)
    .custom(validCharacters)
    .messages(
      joiMessages(field, {
        'string.max': ['tooLong', { max }],
        'string.invalidChars': 'invalidCharacters'
      })
    )
}

// Every field but the survey date, whose three boxes are checked together by
// validateSurveyDate. Joi skips an object's own rules once one of its keys
// fails, so the date cannot be a rule here: the page checks every field at
// once and shows every problem.
const fieldsSchema = Joi.object({
  projectName: projectNameSchema,
  surveyCompleters: optionalText('surveyCompleters', MAX_PERSON_NAME_LENGTH),
  applicant: optionalText('applicant', MAX_PERSON_NAME_LENGTH),
  localPlanningAuthorityReference: Joi.string()
    .trim()
    .empty('')
    .allow(null)
    .default(null)
    .pattern(/^E600\d{5}$/)
    .messages(
      joiMessages('localPlanningAuthorityReference', {
        'string.pattern.base': 'notInList'
      })
    ),
  planningApplicationReference: optionalText(
    'planningApplicationReference',
    MAX_PLANNING_APPLICATION_REFERENCE_LENGTH
  ),
  planningApplicationType: optionalText(
    'planningApplicationType',
    MAX_PLANNING_APPLICATION_TYPE_LENGTH
  ),
  [DAY_KEY]: Joi.string().allow(''),
  [MONTH_KEY]: Joi.string().allow(''),
  [YEAR_KEY]: Joi.string().allow(''),
  returnUrl: Joi.string().allow('')
})

/**
 * The survey date's day, month and year as typed, trimmed.
 *
 * @param {Record<string, string | undefined>} payload
 */
export function datePartsOf(payload) {
  return {
    day: (payload?.[DAY_KEY] ?? '').trim(),
    month: (payload?.[MONTH_KEY] ?? '').trim(),
    year: (payload?.[YEAR_KEY] ?? '').trim()
  }
}

function dateError(rule, parts, values) {
  return {
    name: DATE_FIELD,
    text: formErrorText(DATE_FIELD, rule, values).inline,
    href: `#${DATE_FIELD}-${parts[0]}`,
    parts
  }
}

function isRealDate(day, month, year) {
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function missingPartsError(missing) {
  return missing.length === 1
    ? dateError('missingOne', missing, { part: missing[0] })
    : dateError('missingSeveral', missing, { parts: missing.join(' and ') })
}

/**
 * The GOV.UK date input pattern's checks, in its order: a part left out, a
 * part that is not a number, a date not in the calendar, then a date after
 * today. Only the boxes at fault are highlighted.
 * https://design-system.service.gov.uk/components/date-input/
 *
 * @returns {{ value: string | null } | { error: object }}
 *   the date as the backend stores it (DD/MM/YYYY), null for none, or the
 *   error to show
 */
export function validateSurveyDate(parts, today = new Date()) {
  const missing = DATE_PART_NAMES.filter((part) => parts[part] === '')
  if (missing.length === DATE_PART_NAMES.length) {
    return { value: null }
  }
  if (missing.length) {
    return { error: missingPartsError(missing) }
  }

  const notNumeric = DATE_PART_NAMES.filter(
    (part) => !DIGITS_PATTERN.test(parts[part])
  )
  if (notNumeric.length) {
    return { error: dateError('notNumeric', notNumeric) }
  }

  const day = Number(parts.day)
  const month = Number(parts.month)
  const year = Number(parts.year)
  if (
    parts.year.length !== YEAR_DIGIT_LENGTH ||
    !isRealDate(day, month, year)
  ) {
    return { error: dateError('notReal', DATE_PART_NAMES) }
  }

  const dd = String(day).padStart(DATE_PAD_LENGTH, '0')
  const mm = String(month).padStart(DATE_PAD_LENGTH, '0')
  if (`${year}-${mm}-${dd}` > UK_DATE.format(today)) {
    return { error: dateError('inFuture', DATE_PART_NAMES) }
  }

  return { value: `${dd}/${mm}/${year}` }
}

function fieldError(detail) {
  const name = detail.path[0]
  return { name, text: joiErrorText(detail), href: `#${name}` }
}

function byFieldOrder(a, b) {
  return FIELD_ORDER.indexOf(a.name) - FIELD_ORDER.indexOf(b.name)
}

/**
 * Check every field of a posted project details form at once.
 *
 * @param {Record<string, string>} payload
 * @returns {{ errors: Array<{ name: string, text: string, href: string, parts?: string[] }>, name?: string, details?: object }}
 *   the errors in the order the page shows its fields; with none, the project
 *   name and the details to save
 */
export function validateProjectDetailsForm(payload, today = new Date()) {
  const fields = fieldsSchema.validate(payload ?? {}, { abortEarly: false })
  const date = validateSurveyDate(datePartsOf(payload), today)

  const errors = [
    ...(fields.error?.details.map(fieldError) ?? []),
    ...(date.error ? [date.error] : [])
  ].sort(byFieldOrder)
  if (errors.length) {
    return { errors }
  }

  const details = Object.fromEntries(
    DETAIL_FIELDS.map((field) => [field, fields.value[field]])
  )
  return {
    errors: [],
    name: fields.value.projectName,
    details: { ...details, [DATE_FIELD]: date.value }
  }
}
