import Joi from 'joi'
import Boom from '@hapi/boom'

import {
  fetchProject,
  patchProjectDetails
} from '../common/services/projects.js'
import { statusCodes, HTTP_SUCCESS_MAX } from '../common/constants.js'

const DEVELOPMENT_TYPE_OPTIONS = ['Small site', 'Large site']
const NSIPS_OPTIONS = ['Yes', 'No']

const DATE_FIELD = 'surveyCompletionDate'
const DAY_KEY = `${DATE_FIELD}-day`
const MONTH_KEY = `${DATE_FIELD}-month`
const YEAR_KEY = `${DATE_FIELD}-year`
const DATE_PART_NAMES = ['day', 'month', 'year']
const YEAR_DIGIT_LENGTH = 4
const DIGITS_PATTERN = /^\d+$/
const DATE_ERROR_TYPE = 'surveyCompletionDate.invalid'
const MAX_TEXT_FIELD_LENGTH = 500

function datePartsOf(value) {
  return {
    day: (value[DAY_KEY] ?? '').trim(),
    month: (value[MONTH_KEY] ?? '').trim(),
    year: (value[YEAR_KEY] ?? '').trim()
  }
}

function missingPartsMessage(missing) {
  const article = missing.length === 1 ? 'a ' : ''
  return `Survey completion date must include ${article}${missing.join(' and ')}`
}

function isRealDate(day, month, year) {
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

// Cross-field validation for the GOV.UK date-input pattern: day/month/year
// are posted as three separate fields and combined into a single
// `DD/MM/YYYY` string matching the backend's projectDetailsSchema. Errors
// are raised with an object-level Joi code (rather than on the individual
// day/month/year keys) so a single message can be shown against the whole
// fieldset, per https://design-system.service.gov.uk/components/date-input/
function validateSurveyCompletionDate(value, helpers) {
  const { day, month, year } = datePartsOf(value)
  const result = { ...value }
  delete result[DAY_KEY]
  delete result[MONTH_KEY]
  delete result[YEAR_KEY]

  const present = { day: day !== '', month: month !== '', year: year !== '' }
  if (!present.day && !present.month && !present.year) {
    result[DATE_FIELD] = null
    return result
  }

  const missing = DATE_PART_NAMES.filter((part) => !present[part])
  if (missing.length) {
    return helpers.error(DATE_ERROR_TYPE, {
      message: missingPartsMessage(missing),
      parts: missing
    })
  }

  const invalidFormat =
    !DIGITS_PATTERN.test(day) ||
    !DIGITS_PATTERN.test(month) ||
    !DIGITS_PATTERN.test(year) ||
    year.length !== YEAR_DIGIT_LENGTH

  const dayNum = Number(day)
  const monthNum = Number(month)
  const yearNum = Number(year)

  if (invalidFormat || !isRealDate(dayNum, monthNum, yearNum)) {
    return helpers.error(DATE_ERROR_TYPE, {
      message: 'Survey completion date must be a real date',
      parts: DATE_PART_NAMES
    })
  }

  result[DATE_FIELD] =
    `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}/${yearNum}`
  return result
}

// Mirrors backend projectDetailsSchema (GET/PATCH /projects/{id}/details),
// which allows `null` on every field. Empty fields normalise to explicit
// `null` (via `.empty('').default(null)`) rather than being dropped, so a
// field the user clears is actually cleared server-side — the backend
// merges the PATCH payload into the stored details with a jsonb `||`, which
// leaves omitted keys untouched but overwrites keys sent as `null`.
export const projectDetailsFormSchema = Joi.object({
  localPlanningAuthority: Joi.string()
    .trim()
    .empty('')
    .allow(null)
    .default(null)
    .max(MAX_TEXT_FIELD_LENGTH),
  surveyCompleters: Joi.string()
    .trim()
    .empty('')
    .allow(null)
    .default(null)
    .max(MAX_TEXT_FIELD_LENGTH),
  [DAY_KEY]: Joi.string().trim().allow(''),
  [MONTH_KEY]: Joi.string().trim().allow(''),
  [YEAR_KEY]: Joi.string().trim().allow(''),
  developmentType: Joi.string()
    .empty('')
    .allow(null)
    .default(null)
    .valid(...DEVELOPMENT_TYPE_OPTIONS),
  nsips: Joi.string()
    .empty('')
    .allow(null)
    .default(null)
    .valid(...NSIPS_OPTIONS),
  applicant: Joi.string()
    .trim()
    .empty('')
    .allow(null)
    .default(null)
    .max(MAX_TEXT_FIELD_LENGTH)
})
  .custom(validateSurveyCompletionDate)
  .messages({ [DATE_ERROR_TYPE]: '{{#message}}' })

const PAYLOAD_FIELD_NAMES = new Set(
  Object.keys(projectDetailsFormSchema.describe().keys)
)

function isDateError(detail) {
  return detail.type === DATE_ERROR_TYPE
}

function splitDate(dateString) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateString ?? '')
  if (!match) {
    return { day: '', month: '', year: '' }
  }
  const [, day, month, year] = match
  return { day, month, year }
}

function radioItems(options, selected) {
  return options.map((value) => ({
    value,
    text: value,
    checked: value === selected
  }))
}

function renderForm(
  h,
  { projectId, projectName, details = {}, errors = [], dateParts }
) {
  const fieldErrors = Object.fromEntries(
    errors.map((error) => [error.name, error.text])
  )
  const dateError = errors.find((error) => error.name === DATE_FIELD)
  return h.view('project-details/index', {
    pageTitle: errors.length ? 'Error: Project details' : 'Project details',
    projectId,
    projectName,
    errors,
    fieldErrors,
    details,
    surveyCompletionDate: dateParts ?? splitDate(details.surveyCompletionDate),
    surveyCompletionDateErrorParts: dateError?.parts ?? [],
    developmentTypeItems: radioItems(
      DEVELOPMENT_TYPE_OPTIONS,
      details.developmentType
    ),
    nsipsItems: radioItems(NSIPS_OPTIONS, details.nsips)
  })
}

async function handleValidationFailure(request, h, err) {
  const isPayloadError = err.details.some(
    (detail) => PAYLOAD_FIELD_NAMES.has(detail.path[0]) || isDateError(detail)
  )
  if (!isPayloadError) {
    throw err
  }

  const { projectId } = request.params
  const result = await fetchProject(request, projectId)
  const errors = err.details.map((detail) =>
    isDateError(detail)
      ? {
          name: DATE_FIELD,
          text: detail.context.message,
          href: `#${DATE_FIELD}-${detail.context.parts[0]}`,
          parts: detail.context.parts
        }
      : {
          name: detail.path[0],
          text: detail.message,
          href: `#${detail.path[0]}`
        }
  )
  return renderForm(h, {
    projectId,
    projectName: result?.payload?.project?.name,
    details: request.payload,
    dateParts: datePartsOf(request.payload),
    errors
  }).takeover()
}

export const projectDetailsController = {
  options: {
    validate: {
      params: Joi.object({
        projectId: Joi.string().guid({ version: 'uuidv4' }).required()
      })
    }
  },
  async handler(request, h) {
    const { projectId } = request.params
    const result = await fetchProject(request, projectId)
    if (!result) {
      throw Boom.badGateway('Failed to fetch project')
    }
    if (result.statusCode === statusCodes.notFound) {
      throw Boom.notFound('Project not found')
    }
    if (
      result.statusCode < statusCodes.ok ||
      result.statusCode >= HTTP_SUCCESS_MAX
    ) {
      throw Boom.badGateway('Failed to fetch project')
    }
    return renderForm(h, {
      projectId,
      projectName: result.payload?.project?.name,
      details: result.payload?.project?.details ?? {}
    })
  }
}

export const projectDetailsPostController = {
  options: {
    validate: {
      params: Joi.object({
        projectId: Joi.string().guid({ version: 'uuidv4' }).required()
      }),
      payload: projectDetailsFormSchema,
      failAction: handleValidationFailure
    }
  },
  async handler(request, h) {
    const { projectId } = request.params
    const result = await patchProjectDetails(
      request,
      projectId,
      request.payload
    )
    if (!result) {
      throw Boom.badGateway('Failed to save project details')
    }
    if (result.statusCode === statusCodes.notFound) {
      throw Boom.notFound('Project not found')
    }
    if (
      result.statusCode < statusCodes.ok ||
      result.statusCode >= HTTP_SUCCESS_MAX
    ) {
      throw Boom.badGateway('Failed to save project details')
    }
    return h.redirect(`/add-project-details/${projectId}`)
  }
}
