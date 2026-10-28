import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { backendRequest } from './auth/backend-request.js'
import { backendSaveError } from './backend-save-error.js'
import { getStrategy } from '../../baseline-habitat-details/strategies/index.js'
import { habitatDetailsDestination } from './habitat-details-destination.js'
import {
  HABITAT_REF_ERROR,
  HABITAT_REF_IN_USE_ERROR,
  habitatRefFormFields,
  isRefInUseError,
  isValidHabitatRef
} from './habitat-ref.js'

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

function buildSaveBody({
  habitatRef,
  broadHabitat,
  habitatType,
  condition,
  watercourseEncroachment,
  riparianEncroachment
}) {
  // The backend keeps the stored ref when none is sent, so a form without the
  // reference field never clears it.
  const body = habitatRef === undefined ? {} : { ref: habitatRef.trim() }
  Object.assign(body, {
    broadType: broadHabitat || null,
    habitatType: habitatType || null,
    condition: condition || null
  })
  // Only the watercourse form submits encroachment fields.
  if (watercourseEncroachment !== undefined) {
    body.watercourseEncroachment = watercourseEncroachment || null
  }
  if (riparianEncroachment !== undefined) {
    body.riparianEncroachment = riparianEncroachment || null
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
 * Render the details page for one feature. `submitted` and `errors` are set
 * when a save was refused, so the page shows the user's input and what to fix.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {object} uploadType
 * @param {{ projectId: string, featureId: string, piBackHref?: string | null, submitted?: object, refusal?: { summary: string, inline: string } }} params
 *   `piBackHref` is the post-intervention page the user came from, if any.
 *   `refusal` is why the reference was refused (habitat-ref.js), when it was.
 */
async function renderDetailsPage(
  request,
  h,
  uploadType,
  { projectId, featureId, piBackHref = null, submitted = null, refusal }
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

  return h.view('habitat-details/habitat-details', {
    heading,
    caption: projectName,
    ...viewModel,
    ...habitatRefFormFields({
      heading,
      savedRef: viewModel.habitatRef,
      submittedRef: submitted?.habitatRef,
      refusal
    }),
    formAction: `/${uploadType.detailsRoute}`,
    detailsSectionHeading: uploadType.detailsSectionHeading,
    // Carried through the form so a refused save keeps Back and Cancel.
    returnUrl: piBackHref ?? '',
    backHref: piBackHref ?? viewModel.backHref,
    cancelHref: piBackHref ?? viewModel.cancelHref
  })
}

// What submittedRefToSave answers for a reference that must not be saved.
const REFUSED_REF = Symbol('refused habitat reference')

function isBlank(ref) {
  return ref === undefined || ref === null || String(ref).trim() === ''
}

/**
 * The habitat reference to send with a save, undefined to leave the stored one
 * alone, or REFUSED_REF when the submitted one is invalid.
 *
 * A habitat imported before the BMD-1058 import check can have no reference.
 * Its page shows the input empty, so a save that leaves it empty is not asking
 * to change the reference, only the dropdowns. That save goes ahead without a
 * reference rather than being refused until the user makes one up. Typing a
 * reference, or blanking one that was saved, is still checked.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {object} uploadType
 * @param {{ projectId: string, featureId: string, habitatRef: string | undefined }} params
 * @returns {Promise<string | undefined | symbol>}
 */
async function submittedRefToSave(
  request,
  uploadType,
  { projectId, featureId, habitatRef }
) {
  if (habitatRef === undefined || isValidHabitatRef(habitatRef)) {
    return habitatRef
  }
  if (isBlank(habitatRef)) {
    const { feature } = await fetchFeature(
      request,
      uploadType,
      projectId,
      featureId
    )
    if (isBlank(feature?.ref)) {
      return undefined
    }
  }
  return REFUSED_REF
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

function createPostController(uploadType) {
  return {
    options: {
      validate: {
        payload: Joi.object({
          projectId: Joi.string().uuid().required(),
          featureId: Joi.string().uuid().required(),
          habitatRef: Joi.string().allow('').optional(),
          broadHabitat: Joi.string().allow('').optional(),
          habitatType: Joi.string().allow('').optional(),
          condition: Joi.string().allow('').optional(),
          watercourseEncroachment: Joi.string().allow('').optional(),
          riparianEncroachment: Joi.string().allow('').optional(),
          returnUrl: Joi.string().allow('').optional(),
          crumb: Joi.string().optional()
        })
      }
    },
    async handler(request, h) {
      const {
        projectId,
        featureId,
        habitatRef,
        broadHabitat,
        habitatType,
        condition,
        watercourseEncroachment,
        riparianEncroachment
      } = request.payload

      // A refused reference shows the page again with the error, keeping
      // what the user typed and chose, and the way back they came in by.
      const showRefused = async (refusal) => {
        const response = await renderDetailsPage(request, h, uploadType, {
          projectId,
          featureId,
          piBackHref: returnedPostInterventionHref(
            request.payload.returnUrl,
            projectId
          ),
          submitted: request.payload,
          refusal
        })
        return response.code(statusCodes.badRequest)
      }

      const refToSave = await submittedRefToSave(request, uploadType, {
        projectId,
        featureId,
        habitatRef
      })
      if (refToSave === REFUSED_REF) {
        return showRefused(HABITAT_REF_ERROR)
      }

      const body = buildSaveBody({
        habitatRef: refToSave,
        broadHabitat,
        habitatType,
        condition,
        watercourseEncroachment,
        riparianEncroachment
      })

      let payload
      try {
        const result = await backendRequest(
          request,
          'put',
          `${backendUrl}/${uploadType.backendSavePath(projectId, featureId)}`,
          {
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify(body)
          }
        )
        payload = result.payload
      } catch (err) {
        if (isRefInUseError(err)) {
          return showRefused(HABITAT_REF_IN_USE_ERROR)
        }
        throw backendSaveError(err, featureId)
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
