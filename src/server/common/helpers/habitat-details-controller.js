import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { backendRequest } from './auth/backend-request.js'
import { backendSaveError } from './backend-save-error.js'
import { getStrategy } from '../../baseline-habitat-details/strategies/index.js'
import { habitatDetailsDestination } from './habitat-details-destination.js'
import {
  cleanComment,
  commentFormFields,
  commentRefusals
} from './habitat-comment.js'
import {
  HABITAT_REF_ERROR,
  HABITAT_REF_TOO_LONG_ERROR,
  habitatRefFormFields,
  habitatRefRefusal,
  isRefUnchanged
} from './habitat-ref.js'
import {
  featureNotEditableRefusal,
  isFeatureNotEditableError
} from './feature-not-editable-refusal.js'
import {
  isStoredValueRefusal,
  storedValueRefusal
} from './stored-value-refusal.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

async function fetchProjectName(request, projectId) {
  try {
    const { payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}/projects/${projectId}`
    )
    return payload?.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

/**
 * Fetch the full project payload, or null when the request fails. Callers that
 * only need the name should use fetchProjectName; this is for callers that also
 * need the stored feature lists (e.g. resolving a baseline feature by ref).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} projectId
 * @returns {Promise<object|null>}
 */
async function fetchProject(request, projectId) {
  try {
    const { payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}/projects/${projectId}`
    )
    return payload ?? null
  } catch {
    return null
  }
}

async function fetchFeature(request, uploadType, projectId, featureId) {
  try {
    const { payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}/${uploadType.backendFeaturePath(projectId, featureId)}`
    )
    return payload
  } catch (err) {
    if (
      err.output?.statusCode === statusCodes.notFound ||
      err.data?.res?.statusCode === statusCodes.notFound
    ) {
      throw Boom.notFound(`Feature ${featureId} not found`)
    }
    throw err
  }
}

/**
 * Return a flattened feature shape that strategies can consume, promoting
 * `proposed.*` fields to top level while preserving the raw `proposed` and
 * `baseline` sub-objects for comparison rendering.
 *
 * @param {object} feature
 * @returns {object}
 */
export function normalizePostInterventionFeatureForDisplay(feature) {
  const proposed = feature.proposed ?? {}
  return {
    ...feature,
    ...proposed,
    baseline: feature.baseline,
    proposed: feature.proposed
  }
}

/**
 * A submitted field as the backend expects it: an empty value clears whatever
 * is stored, which the backend represents as null rather than ''.
 *
 * @param {string | undefined} value
 * @returns {string | null}
 */
function orNull(value) {
  return value || null
}

function buildSaveBody({
  habitatRef,
  broadHabitat,
  habitatType,
  condition,
  watercourseEncroachment,
  riparianEncroachment,
  comment
}) {
  // The backend keeps the stored ref when none is sent, so a form without the
  // reference field never clears it.
  const body = habitatRef === undefined ? {} : { ref: habitatRef.trim() }
  Object.assign(body, {
    broadType: orNull(broadHabitat),
    habitatType: orNull(habitatType),
    condition: orNull(condition)
  })
  // Only the watercourse form submits encroachment fields.
  if (watercourseEncroachment !== undefined) {
    body.watercourseEncroachment = orNull(watercourseEncroachment)
  }
  if (riparianEncroachment !== undefined) {
    body.riparianEncroachment = orNull(riparianEncroachment)
  }
  // A form without the comment field must not clear a stored comment.
  // Whitespace-only is stored as no value.
  if (comment !== undefined) {
    body.comment = orNull(cleanComment(comment))
  }
  return body
}

const PI_DETAILS_PATH = '/post-intervention-habitat-details'

/**
 * The post-intervention details page `url` points at, rebuilt from its
 * featureId and projectId alone, or null when it is not one for this project.
 *
 * @param {URL} url
 * @param {string} projectId
 * @returns {string | null}
 */
function postInterventionDetailsHref(url, projectId) {
  const featureId = url.searchParams.get('featureId')
  if (
    url.pathname === PI_DETAILS_PATH &&
    url.searchParams.get('projectId') === projectId &&
    !Joi.string().uuid().required().validate(featureId).error
  ) {
    return `${PI_DETAILS_PATH}?${new URLSearchParams({
      featureId,
      projectId
    }).toString()}`
  }
  return null
}

/**
 * Where Back and Cancel go when the page was opened from "View baseline
 * details" on a post-intervention details page: the referrer, on GET.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} projectId
 * @returns {string | null}
 */
function postInterventionBackHref(request, projectId) {
  try {
    const referer = new URL(request.headers.referer)
    return referer.host === request.headers.host
      ? postInterventionDetailsHref(referer, projectId)
      : null
  } catch {
    // Missing or malformed referrers use the baseline summary fallback.
    return null
  }
}

/**
 * The same origin carried through the form as `returnUrl`, on a POST, whose
 * referrer is the baseline page itself. Only a same-site path is taken.
 *
 * @param {unknown} returnUrl
 * @param {string} projectId
 * @returns {string | null}
 */
function returnedPostInterventionHref(returnUrl, projectId) {
  if (
    typeof returnUrl !== 'string' ||
    !returnUrl.startsWith('/') ||
    returnUrl.startsWith('//')
  ) {
    return null
  }
  return postInterventionDetailsHref(
    new URL(returnUrl, 'http://localhost'),
    projectId
  )
}

// Form fields that only some feature types submit. A field the form did not
// send keeps the stored value: hedgerows and watercourses have no broad
// habitat, and only watercourses have encroachment.
const OPTIONAL_CHOICE_FIELDS = Object.freeze([
  { field: 'broadHabitat', featureKey: 'broadType' },
  { field: 'watercourseEncroachment', featureKey: 'watercourseEncroachment' },
  { field: 'riparianEncroachment', featureKey: 'riparianEncroachment' }
])

/**
 * The reference-data entry for a habitat type, or undefined. Area habitat
 * types belong to a broad habitat; hedgerow and watercourse types have none
 * (`broad: null`).
 *
 * @param {object} reference the strategy's reference data
 * @param {{ type: string | null, broadType?: string | null }} chosen
 * @returns {object | undefined}
 */
function findHabitatType(reference, { type, broadType }) {
  return reference.habitatTypes?.find(
    (t) =>
      t.name === type && ((t.broad ?? null) === null || t.broad === broadType)
  )
}

/**
 * The stored feature with the user's unsaved dropdown choices laid over it, so
 * a page shown again with an error keeps what they picked. Distinctiveness
 * follows the chosen habitat type, as the client JS shows it before a save;
 * units stay as stored until the edit is saved.
 *
 * @param {object} feature as stored
 * @param {object} submitted the POSTed form fields
 * @param {object} reference the strategy's reference data
 * @returns {object}
 */
function withSubmittedChoices(feature, submitted, reference) {
  const chosen = {
    ...feature,
    type: submitted.habitatType || null,
    condition: submitted.condition || null
  }
  for (const { field, featureKey } of OPTIONAL_CHOICE_FIELDS) {
    if (submitted[field] !== undefined) {
      chosen[featureKey] = submitted[field] || null
    }
  }
  const typeEntry = findHabitatType(reference, chosen)
  chosen.distinctiveness = typeEntry?.distinctiveness ?? null
  chosen.distinctivenessScore = typeEntry?.distinctivenessScore ?? null
  return chosen
}

/**
 * Render the details page for one feature. `submitted` and `refusal` are set
 * when a save was refused, so the page shows the user's input and what to fix.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {object} uploadType
 * @param {{ projectId: string, featureId: string, piBackHref?: string | null, submitted?: object, refusals?: { habitatRef?: { summary: string, inline: string } | { summaryOnly: string }, comment?: Array<{ summary: string, inline: string }> } }} params
 *   `piBackHref` is the post-intervention page the user came from, if any.
 *   `refusals` names the fields a save refused, when it did. A habitat
 *   reference refusal may be a stored value the service no longer accepts
 *   (stored-value-refusal.js).
 */
async function renderDetailsPage(
  request,
  h,
  uploadType,
  { projectId, featureId, piBackHref = null, submitted = null, refusals }
) {
  const [{ type, feature: rawFeature }, projectName] = await Promise.all([
    fetchFeature(request, uploadType, projectId, featureId),
    fetchProjectName(request, projectId)
  ])

  const storedFeature = uploadType.isPostIntervention
    ? normalizePostInterventionFeatureForDisplay(rawFeature)
    : rawFeature
  const strategy = getStrategy(type)
  let feature = storedFeature
  let reference = await strategy.loadReference(storedFeature)
  if (submitted) {
    feature = withSubmittedChoices(storedFeature, submitted, reference)
    // Conditions depend on the chosen habitat type, so reload for it.
    reference = await strategy.loadReference(feature)
  }
  const viewModel = strategy.buildViewModel(feature, reference, {
    projectId,
    projectName
  })
  // The heading names the habitat by its saved reference, not by an unsaved
  // (possibly blank) one in the input.
  const heading = `${viewModel.headingPrefix} ${viewModel.habitatRef}`.trimEnd()
  const refFields = habitatRefFormFields({
    heading,
    savedRef: viewModel.habitatRef,
    submittedRef: submitted?.habitatRef,
    refusal: refusals?.habitatRef
  })
  const commentFields = commentFormFields({
    savedComment: storedFeature.comment,
    submittedComment: submitted?.comment,
    refusals: refusals?.comment ?? []
  })
  // Page order: the reference sits above the comment. Each field's own
  // fields are named rather than spread, so neither can overwrite the page's
  // error summary or title.
  const errors = [...refFields.errors, ...commentFields.commentErrors]
  return h.view('habitat-details/habitat-details', {
    heading,
    caption: projectName,
    ...viewModel,
    habitatRefInput: refFields.habitatRefInput,
    commentInput: commentFields.commentInput,
    errors,
    pageTitle: errors.length > 0 ? `Error: ${heading}` : heading,
    formAction: `/${uploadType.detailsRoute}`,
    detailsSectionHeading: uploadType.detailsSectionHeading,
    // Carried through the form so a refused save keeps Back and Cancel.
    returnUrl: piBackHref ?? '',
    backHref: piBackHref ?? viewModel.backHref,
    cancelHref: piBackHref ?? viewModel.cancelHref
  })
}

/**
 * The habitat reference to send with a save (`ref`, undefined to leave the
 * stored one alone), or why the submitted one is refused (`refusal`).
 *
 * Only a reference the user changed is checked and sent. A habitat imported
 * before the BMD-1058 and BMD-1175 import checks may hold one that would not
 * pass today: no reference at all, characters that are not UTF-8, surrounding
 * spaces, or more than 99 characters. Its page shows it as stored, so a save
 * that leaves it as it is only asks to change the dropdowns. Checking it would
 * refuse that save until the user made a new one up, and sending it would
 * have the backend trim or refuse it. Blanking the field where a reference
 * was saved is still a change, and still refused; so is a changed reference
 * that is still too long, which the user is asked to shorten.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {object} uploadType
 * @param {{ projectId: string, featureId: string, habitatRef: string | undefined }} params
 * @returns {Promise<{ ref?: string, refusal?: { summary: string, inline: string } }>}
 */
async function submittedRefToSave(
  request,
  uploadType,
  { projectId, featureId, habitatRef }
) {
  if (habitatRef === undefined) {
    return {}
  }
  const { feature } = await fetchFeature(
    request,
    uploadType,
    projectId,
    featureId
  )
  if (isRefUnchanged(habitatRef, feature?.ref)) {
    return {}
  }
  const refusal = habitatRefRefusal(habitatRef)
  return refusal ? { refusal } : { ref: habitatRef }
}

function createGetController(uploadType) {
  return {
    options: {
      validate: {
        query: Joi.object({
          featureId: Joi.string().uuid().required(),
          projectId: Joi.string().uuid().required()
        })
      }
    },
    handler(request, h) {
      const { featureId, projectId } = request.query
      return renderDetailsPage(request, h, uploadType, {
        projectId,
        featureId,
        piBackHref: uploadType.isPostIntervention
          ? null
          : postInterventionBackHref(request, projectId)
      })
    }
  }
}

/**
 * Save a habitat, so a refusal keeps its meaning instead of always reading as
 * an upstream failure (backendSaveError): an expired session passes through,
 * and 409, 404 and 400 keep theirs. A reference another habitat carries, or a
 * value the habitat has held since before the service checked text lengths
 * and lists (stored-value-refusal.js), is thrown as it is, for the form to
 * show. Shared by the baseline and Created-area forms.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} path backend path, without the base URL
 * @param {object} body
 * @param {string} [featureId] for the not-found message
 * @returns {Promise<object>} the backend's payload
 */
export async function saveHabitat(request, path, body, featureId) {
  try {
    const { res, payload } = await backendRequest(
      request,
      'put',
      `${backendUrl}/${path}`,
      {
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(body)
      }
    )
    if (res?.statusCode >= statusCodes.badRequest) {
      throw Boom.boomify(new Error('Backend rejected habitat save'), {
        statusCode: res.statusCode
      })
    }
    return payload
  } catch (err) {
    // An older stored value, or an edit this feature does not take, is for
    // the form to show. Each is thrown as it is: backendSaveError would
    // rebuild it and drop the code the form tells them apart by.
    if (isStoredValueRefusal(err) || isFeatureNotEditableError(err)) {
      throw err
    }
    throw backendSaveError(err, featureId)
  }
}

const habitatDetailsPayload = Joi.object({
  projectId: Joi.string().uuid().required(),
  featureId: Joi.string().uuid().required(),
  habitatRef: Joi.string().allow('').optional(),
  // No length limit here: a long comment must reach the handler and become a
  // field error, not a flat 400 error page.
  comment: Joi.string().allow('').optional(),
  broadHabitat: Joi.string().allow('').optional(),
  habitatType: Joi.string().allow('').optional(),
  condition: Joi.string().allow('').optional(),
  watercourseEncroachment: Joi.string().allow('').optional(),
  riparianEncroachment: Joi.string().allow('').optional(),
  returnUrl: Joi.string().allow('').optional(),
  crumb: Joi.string().optional()
})

/**
 * The refusal to show for a save the backend refused, or null when the error
 * is not one for the form to show.
 */
function saveErrorRefusal(err, refToSave) {
  // The backend checks a reference again; if it refuses one this side
  // passed, say so at the field rather than on an error page.
  // A value saved before the service checked text lengths and lists
  // refuses any save of the habitat, whatever was changed.
  if (isStoredValueRefusal(err)) {
    return storedValueRefusal(err, { refTooLong: HABITAT_REF_TOO_LONG_ERROR })
  }
  // An edit the backend cannot carry out on this feature, such as a change to
  // a tree's broad habitat or habitat type. It shares the 400 a refused
  // reference gets, so it is recognised by its code first: no field on the
  // page is to blame, and blaming the reference for it would put an error on
  // a reference that is valid.
  if (isFeatureNotEditableError(err)) {
    return featureNotEditableRefusal()
  }
  if (
    refToSave !== undefined &&
    err.output?.statusCode === statusCodes.badRequest
  ) {
    return HABITAT_REF_ERROR
  }
  return null
}

/**
 * Show the details page again with field errors, keeping what the user typed
 * and chose, and the way back they came in by.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {object} uploadType
 * @param {{ projectId: string, featureId: string, refusals: object }} options
 */
async function showRefusedDetailsPage(
  request,
  h,
  uploadType,
  { projectId, featureId, refusals }
) {
  const response = await renderDetailsPage(request, h, uploadType, {
    projectId,
    featureId,
    piBackHref: returnedPostInterventionHref(
      request.payload.returnUrl,
      projectId
    ),
    submitted: request.payload,
    refusals
  })
  return response.code(statusCodes.badRequest)
}

/**
 * The field errors a submission carries. A bad reference and a bad comment are
 * reported together, so this collects both before the page is shown again.
 *
 * @param {{ refusal: string | null | undefined, comment: string | undefined }} submitted
 * @returns {object} refusals by field name; empty when the submission is good
 */
function submittedFieldRefusals({ refusal, comment }) {
  const fieldRefusals = {}
  if (refusal) {
    fieldRefusals.habitatRef = refusal
  }
  const commentProblems = commentRefusals(comment)
  if (commentProblems.length > 0) {
    fieldRefusals.comment = commentProblems
  }
  return fieldRefusals
}

function createPostController(uploadType) {
  return {
    options: { validate: { payload: habitatDetailsPayload } },
    async handler(request, h) {
      const {
        projectId,
        featureId,
        habitatRef,
        broadHabitat,
        habitatType,
        condition,
        watercourseEncroachment,
        riparianEncroachment,
        comment
      } = request.payload

      const { ref: refToSave, refusal } = await submittedRefToSave(
        request,
        uploadType,
        {
          projectId,
          featureId,
          habitatRef
        }
      )
      const showRefused = (refusedFields) =>
        showRefusedDetailsPage(request, h, uploadType, {
          projectId,
          featureId,
          refusals: refusedFields
        })

      const fieldRefusals = submittedFieldRefusals({ refusal, comment })
      if (Object.keys(fieldRefusals).length > 0) {
        return showRefused(fieldRefusals)
      }

      const body = buildSaveBody({
        habitatRef: refToSave,
        broadHabitat,
        habitatType,
        condition,
        watercourseEncroachment,
        riparianEncroachment,
        comment
      })

      let payload
      try {
        payload = await saveHabitat(
          request,
          uploadType.backendSavePath(projectId, featureId),
          body,
          featureId
        )
      } catch (err) {
        const saveRefusal = saveErrorRefusal(err, refToSave)
        if (saveRefusal) {
          return showRefused({ habitatRef: saveRefusal })
        }
        throw err
      }

      return h.redirect(
        habitatDetailsDestination(projectId, payload?.type, uploadType.key)
      )
    }
  }
}

function createHabitatDetailsControllers(uploadType) {
  return {
    getController: createGetController(uploadType),
    postController: createPostController(uploadType)
  }
}

export {
  createHabitatDetailsControllers,
  fetchFeature,
  fetchProjectName,
  fetchProject
}
