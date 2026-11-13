import Joi from 'joi'
import Boom from '@hapi/boom'

import { patchProjectDetails } from '../common/services/projects.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import { statusCodes, HTTP_SUCCESS_MAX } from '../common/constants.js'
import { fetchLocalPlanningAuthorities } from '../common/services/local-planning-authorities.js'
import { formErrorText } from '../common/error-text/error-text.js'
import { MAX_PROJECT_NAME_LENGTH } from '../common/helpers/project-name.js'
import { isSafeRelativePath } from '../common/helpers/upload-file-navigation.js'
import {
  PROJECT_DETAILS_TEXT,
  PROJECT_SUMMARY_PATH,
  buildUnitTypeNavigation,
  projectDetailsPath,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import {
  MAX_PERSON_NAME_LENGTH,
  MAX_PLANNING_APPLICATION_REFERENCE_LENGTH,
  MAX_PLANNING_APPLICATION_TYPE_LENGTH
} from './constants.js'
import {
  DATE_FIELD,
  datePartsOf,
  validateProjectDetailsForm
} from './validation.js'

// The words shown in the error summary and against the field are the same,
// so only the inline text is needed.
const LPA_NOT_IN_LIST = formErrorText(
  'localPlanningAuthorityReference',
  'notInList'
).inline

// The backend's words when it refuses an authority it does not hold
// (local-planning-authorities.js). Any other 400 is a contract mismatch,
// not something the user can fix.
const BACKEND_LPA_REFUSAL = /local planning authority/i

// Every posted value is text: a field posted twice arrives as an array and is
// refused here with a 400. The fields themselves are checked by
// validateProjectDetailsForm, so each problem can be shown on the page.
const formPayload = Joi.object()
  .pattern(Joi.string(), Joi.string().allow(''))
  .allow(null)

const projectIdParams = Joi.object({
  projectId: Joi.string().guid({ version: 'uuidv4' }).required()
})

/**
 * Where Save and Cancel go back to (BMD-849): the page the user followed the
 * "Project details" link from, which the link names in `returnUrl`. A missing
 * or off-site one falls back to the project summary.
 */
function safeReturnUrl(returnUrl, projectId) {
  return isSafeRelativePath(returnUrl)
    ? returnUrl
    : projectPageHref(projectId, PROJECT_SUMMARY_PATH)
}

function splitDate(dateString) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateString ?? '')
  if (!match) {
    return { day: '', month: '', year: '' }
  }
  const [, day, month, year] = match
  return { day, month, year }
}

/**
 * @param {object} options
 * @param {object} options.project - the project, for the navigation
 * @param {object} options.values - the fields' values, keyed as the form
 *   posts them, but with the survey date as `dateParts`
 */
function renderForm(
  h,
  { projectId, project, values, dateParts, returnUrl, authorities, errors = [] }
) {
  const fieldErrors = Object.fromEntries(
    errors.map((error) => [error.name, error.text])
  )
  const dateError = errors.find((error) => error.name === DATE_FIELD)
  return h.view('project-details/index', {
    pageTitle: errors.length
      ? `Error: ${PROJECT_DETAILS_TEXT}`
      : PROJECT_DETAILS_TEXT,
    heading: PROJECT_DETAILS_TEXT,
    projectId,
    formAction: projectDetailsPath(projectId),
    returnUrl,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      projectDetailsPath(projectId)
    ),
    errors,
    fieldErrors,
    values,
    surveyCompletionDate: dateParts,
    surveyCompletionDateErrorParts: dateError?.parts ?? [],
    maxLengths: {
      projectName: MAX_PROJECT_NAME_LENGTH,
      personName: MAX_PERSON_NAME_LENGTH,
      planningApplicationReference: MAX_PLANNING_APPLICATION_REFERENCE_LENGTH,
      planningApplicationType: MAX_PLANNING_APPLICATION_TYPE_LENGTH
    },
    localPlanningAuthorityItems: [
      {
        value: '',
        text: 'Choose local planning authority',
        selected: !values.localPlanningAuthorityReference
      },
      ...authorities.map(({ name, reference }) => ({
        value: reference,
        text: name,
        selected: reference === values.localPlanningAuthorityReference
      }))
    ]
  })
}

// The page shown again after a refusal: every value as the user entered it.
async function renderRefusal(request, h, errors) {
  const { projectId } = request.params
  const payload = request.payload ?? {}
  return renderForm(h, {
    projectId,
    project: await fetchProjectOrThrow(request, projectId),
    values: payload,
    dateParts: datePartsOf(payload),
    returnUrl: safeReturnUrl(payload.returnUrl, projectId),
    authorities: await fetchLocalPlanningAuthorities(),
    errors
  })
}

export const projectDetailsController = {
  options: {
    validate: {
      params: projectIdParams,
      query: Joi.object({ returnUrl: Joi.string().allow('') })
    }
  },
  async handler(request, h) {
    const { projectId } = request.params
    const project = await fetchProjectOrThrow(request, projectId)
    const details = project?.details ?? {}
    return renderForm(h, {
      projectId,
      project,
      values: { ...details, projectName: project?.name },
      dateParts: splitDate(details.surveyCompletionDate),
      returnUrl: safeReturnUrl(request.query.returnUrl, projectId),
      authorities: await fetchLocalPlanningAuthorities()
    })
  }
}

export const projectDetailsPostController = {
  options: {
    validate: {
      params: projectIdParams,
      payload: formPayload
    }
  },
  async handler(request, h) {
    const { projectId } = request.params
    // Every field is checked before anything is saved, and a problem with
    // any of them saves none of them (BMD-849 AC10).
    const { errors, name, details } = validateProjectDetailsForm(
      request.payload
    )
    if (errors.length) {
      return renderRefusal(request, h, errors)
    }

    const result = await patchProjectDetails(request, projectId, {
      name,
      ...details
    })
    if (!result) {
      throw Boom.badGateway('Failed to save project details')
    }
    if (result.statusCode === statusCodes.notFound) {
      throw Boom.notFound('Project not found')
    }
    // The list's options are the backend's, so only an authority it has
    // since dropped is refused here.
    if (
      result.statusCode === statusCodes.badRequest &&
      details.localPlanningAuthorityReference &&
      BACKEND_LPA_REFUSAL.test(result.payload?.message ?? '')
    ) {
      return renderRefusal(request, h, [
        {
          name: 'localPlanningAuthorityReference',
          href: '#localPlanningAuthorityReference',
          text: LPA_NOT_IN_LIST
        }
      ])
    }
    if (
      result.statusCode < statusCodes.ok ||
      result.statusCode >= HTTP_SUCCESS_MAX
    ) {
      throw Boom.badGateway('Failed to save project details')
    }
    return h.redirect(safeReturnUrl(request.payload.returnUrl, projectId))
  }
}
