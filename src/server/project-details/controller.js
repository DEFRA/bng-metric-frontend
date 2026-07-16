import Joi from 'joi'
import Boom from '@hapi/boom'

import {
  fetchProject,
  patchProjectDetails
} from '../common/services/projects.js'
import { statusCodes, HTTP_SUCCESS_MAX } from '../common/constants.js'

const DEVELOPMENT_TYPE_OPTIONS = ['Small site', 'Large site']
const NSIPS_OPTIONS = ['Yes', 'No']
const SURVEY_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/

// Mirrors backend projectDetailsSchema (GET/PATCH /projects/{id}/details).
// Empty fields normalise to `undefined` via `.empty('')` so the PATCH payload
// only ever carries fields the user actually filled in.
export const projectDetailsFormSchema = Joi.object({
  localPlanningAuthority: Joi.string().trim().empty('').max(500),
  surveyCompleters: Joi.string().trim().empty('').max(500),
  surveyCompletionDate: Joi.string()
    .trim()
    .empty('')
    .pattern(SURVEY_DATE_PATTERN)
    .messages({
      'string.pattern.base':
        'Survey completion date must be in the format DD/MM/YYYY'
    }),
  developmentType: Joi.string()
    .empty('')
    .valid(...DEVELOPMENT_TYPE_OPTIONS),
  nsips: Joi.string()
    .empty('')
    .valid(...NSIPS_OPTIONS),
  applicant: Joi.string().trim().empty('').max(500)
})

const PAYLOAD_FIELD_NAMES = new Set(
  Object.keys(projectDetailsFormSchema.describe().keys)
)

function radioItems(options, selected) {
  return options.map((value) => ({
    value,
    text: value,
    checked: value === selected
  }))
}

function renderForm(h, { projectId, projectName, details = {}, errors = [] }) {
  const fieldErrors = Object.fromEntries(
    errors.map((error) => [error.name, error.text])
  )
  return h.view('project-details/index', {
    pageTitle: errors.length ? 'Error: Project details' : 'Project details',
    projectId,
    projectName,
    errors,
    fieldErrors,
    details,
    developmentTypeItems: radioItems(
      DEVELOPMENT_TYPE_OPTIONS,
      details.developmentType
    ),
    nsipsItems: radioItems(NSIPS_OPTIONS, details.nsips)
  })
}

async function handleValidationFailure(request, h, err) {
  const isPayloadError = err.details.some((detail) =>
    PAYLOAD_FIELD_NAMES.has(detail.path[0])
  )
  if (!isPayloadError) {
    throw err
  }

  const { projectId } = request.params
  const result = await fetchProject(request, projectId)
  const errors = err.details.map((detail) => ({
    name: detail.path[0],
    text: detail.message,
    href: `#${detail.path[0]}`
  }))
  return renderForm(h, {
    projectId,
    projectName: result?.payload?.project?.name,
    details: request.payload,
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
