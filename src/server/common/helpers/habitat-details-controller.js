import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../../config/config.js'
import { DEFAULT_PROJECT_NAME, statusCodes } from '../constants.js'
import { lockedFieldDisplays } from '../../baseline-habitat-details/locked-fields.js'
import { hasPostInterventionData } from './project-state.js'
import { supportingInformationDisplay } from './supporting-information.js'
import { backendRequest } from './auth/backend-request.js'
import { backendSaveError } from './backend-save-error.js'
import { isInvalidEnhancementError } from './invalid-enhancement-refusal.js'
import { isInvalidDegradeError } from './invalid-degrade-refusal.js'
import { getStrategy } from '../../baseline-habitat-details/strategies/index.js'
import { isServiceTemplateDocument } from './service-template.js'
import { habitatDetailsDestination } from './habitat-details-destination.js'
import { TREE_SIZES } from './tree-details.js'
import {
  postInterventionBackHref,
  returnedPostInterventionHref
} from './post-intervention-return.js'
import {
  cleanComment,
  commentFormFields,
  commentRefusals
} from './habitat-comment.js'
import {
  HABITAT_REF_ERROR,
  HABITAT_REF_IN_USE_ERROR,
  HABITAT_REF_TOO_LONG_ERROR,
  habitatRefFormFields,
  habitatRefRefusal,
  isRefInUseError,
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

/**
 * Fetch the full project payload, or null when the request fails: its name,
 * the template its documents were uploaded in, and the stored feature lists
 * (e.g. for resolving a baseline feature by ref).
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
  treeSize,
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
  // Only a BNG Service template tree's form submits a size class. A blank one
  // is left out: the backend keeps the stored size, which cannot be cleared.
  if (treeSize) {
    body.treeSize = treeSize
  }
  // A form without the comment field must not clear a stored comment.
  // Whitespace-only is stored as no value.
  if (comment !== undefined) {
    body.comment = orNull(cleanComment(comment))
  }
  return body
}

// Form fields that only some feature types submit. A field the form did not
// send keeps the stored value: hedgerows and watercourses have no broad
// habitat, and only watercourses have encroachment.
const OPTIONAL_CHOICE_FIELDS = Object.freeze([
  { field: 'broadHabitat', featureKey: 'broadType' },
  { field: 'watercourseEncroachment', featureKey: 'watercourseEncroachment' },
  { field: 'riparianEncroachment', featureKey: 'riparianEncroachment' },
  { field: 'treeSize', featureKey: 'treeSize' }
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
  const { locked, projectName, storedFeature, viewModel } =
    await loadDetailsViewModel(request, uploadType, {
      projectId,
      featureId,
      submitted
    })
  // The heading names the habitat by its saved reference, not by an unsaved
  // (possibly blank) one in the input.
  const heading = `${viewModel.headingPrefix} ${viewModel.habitatRef}`.trimEnd()
  const backLinks = {
    backHref: piBackHref ?? viewModel.backHref,
    cancelHref: piBackHref ?? viewModel.cancelHref
  }
  // Once post-intervention data is uploaded the baseline is locked (BMD-1194):
  // every value is shown as text and there is nothing to save.
  if (locked) {
    return h.view('habitat-details/habitat-details', {
      heading,
      caption: projectName,
      ...viewModel,
      ...lockedFieldDisplays(viewModel),
      locked: true,
      commentDisplay: supportingInformationDisplay(storedFeature.comment),
      pageTitle: heading,
      detailsSectionHeading: uploadType.detailsSectionHeading,
      ...backLinks
    })
  }
  const { habitatRefInput, commentInput, errors } = editableFieldInputs({
    heading,
    viewModel,
    storedFeature,
    submitted,
    refusals
  })
  return h.view('habitat-details/habitat-details', {
    heading,
    caption: projectName,
    ...viewModel,
    habitatRefInput,
    commentInput,
    errors,
    pageTitle: errors.length > 0 ? `Error: ${heading}` : heading,
    formAction: `/${uploadType.detailsRoute}`,
    detailsSectionHeading: uploadType.detailsSectionHeading,
    // Carried through the form so a refused save keeps Back and Cancel.
    returnUrl: piBackHref ?? '',
    ...backLinks
  })
}

/**
 * The project and the habitat's view model for its details page, with any
 * submitted choices laid over the stored ones.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {object} uploadType
 * @param {{ projectId: string, featureId: string, submitted: object | null }} params
 * @returns {Promise<{ locked: boolean, projectName: string, storedFeature: object, viewModel: object }>}
 */
async function loadDetailsViewModel(
  request,
  uploadType,
  { projectId, featureId, submitted }
) {
  const [{ type, feature: rawFeature }, projectPayload] = await Promise.all([
    fetchFeature(request, uploadType, projectId, featureId),
    fetchProject(request, projectId)
  ])
  const project = projectPayload?.project
  const projectName = project?.name ?? DEFAULT_PROJECT_NAME
  const stage = uploadType.isPostIntervention ? 'postIntervention' : 'baseline'

  const storedFeature = uploadType.isPostIntervention
    ? normalizePostInterventionFeatureForDisplay(rawFeature)
    : rawFeature
  // Decided before any submitted choices are laid over the stored ones: a
  // locked page shows only what is stored, even when the lock arrived while
  // a refused submission was on its way back to the form.
  const locked =
    !uploadType.isPostIntervention && hasPostInterventionData(project)
  const strategy = getStrategy(type)
  let feature = storedFeature
  let reference = await strategy.loadReference(storedFeature)
  if (submitted && !locked) {
    feature = withSubmittedChoices(storedFeature, submitted, reference)
    // Conditions depend on the chosen habitat type, so reload for it.
    reference = await strategy.loadReference(feature)
  }
  const viewModel = strategy.buildViewModel(feature, reference, {
    projectId,
    projectName,
    serviceTemplate: isServiceTemplateDocument(project?.[stage])
  })
  return { locked, projectName, storedFeature, viewModel }
}

/**
 * The reference and comment inputs of the editable page, and their errors.
 *
 * @param {{ heading: string, viewModel: object, storedFeature: object, submitted: object | null, refusals: object | undefined }} params
 * @returns {{ habitatRefInput: object, commentInput: object, errors: object[] }}
 */
function editableFieldInputs({
  heading,
  viewModel,
  storedFeature,
  submitted,
  refusals
}) {
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
  return {
    habitatRefInput: refFields.habitatRefInput,
    commentInput: commentFields.commentInput,
    errors: [...refFields.errors, ...commentFields.commentErrors]
  }
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
    // A reference another habitat already carries, an older stored value, an
    // edit this feature does not take, an enhancement its baseline does not
    // allow, or an Existing tree Created over its baseline tree that does not
    // follow the guide's steps, is for the form to show. Each is thrown as it is:
    // backendSaveError would rebuild it and drop the code the form tells them
    // apart by.
    if (
      isRefInUseError(err) ||
      isStoredValueRefusal(err) ||
      isFeatureNotEditableError(err) ||
      isInvalidEnhancementError(err) ||
      isInvalidDegradeError(err)
    ) {
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
  treeSize: Joi.string()
    .valid('', ...TREE_SIZES)
    .optional(),
  returnUrl: Joi.string().allow('').optional(),
  crumb: Joi.string().optional()
})

/**
 * The refusal to show for a save the backend refused, or null when the error
 * is not one for the form to show.
 */
function saveErrorRefusal(err, refToSave) {
  // The backend checks a reference again; if it refuses one this side
  // passed, or one another habitat already carries, say so at the field
  // rather than on an error page.
  if (isRefInUseError(err)) {
    return HABITAT_REF_IN_USE_ERROR
  }
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

/**
 * Whether this baseline habitat is locked because post-intervention data is
 * uploaded (BMD-1194). The page hides the form, but a page left open from
 * before the upload, or a direct POST, still reaches the save, so the save
 * checks too. A project that cannot be fetched refuses the save (502): the
 * lock cannot be checked, so the save must not go ahead. The page, which
 * saves nothing, still shows the form then.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {object} uploadType
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
async function isBaselineLocked(request, uploadType, projectId) {
  if (uploadType.isPostIntervention) {
    return false
  }
  const project = (await fetchProject(request, projectId))?.project
  if (!project) {
    throw Boom.badGateway('Could not check whether the baseline is locked')
  }
  return hasPostInterventionData(project)
}

/**
 * The locked page, for a save refused because the baseline is locked: nothing
 * is saved and the locked values are shown instead. It is rendered here, not
 * redirected to, so Back keeps the post-intervention page the form carried in
 * returnUrl; the GET page only has the referrer.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {object} uploadType
 */
function showLockedDetailsPage(request, h, uploadType) {
  const { projectId, featureId, returnUrl } = request.payload
  return renderDetailsPage(request, h, uploadType, {
    projectId,
    featureId,
    piBackHref: returnedPostInterventionHref(returnUrl, projectId)
  })
}

function createPostController(uploadType) {
  return {
    options: { validate: { payload: habitatDetailsPayload } },
    async handler(request, h) {
      if (
        await isBaselineLocked(request, uploadType, request.payload.projectId)
      ) {
        return showLockedDetailsPage(request, h, uploadType)
      }

      const {
        projectId,
        featureId,
        habitatRef,
        broadHabitat,
        habitatType,
        condition,
        watercourseEncroachment,
        riparianEncroachment,
        treeSize,
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
        treeSize,
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

export { createHabitatDetailsControllers, fetchFeature, fetchProject }
