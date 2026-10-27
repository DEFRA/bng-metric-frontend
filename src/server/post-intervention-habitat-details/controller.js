import Joi from 'joi'

import { statusCodes } from '../common/constants.js'

import {
  fetchFeature,
  fetchProject
} from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { isSafeRelativePath } from '../common/helpers/upload-file-navigation.js'
import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'
import { buildCreatedWatercourseViewOnlyViewModel } from './created-watercourse-view-only-view-model.js'
import { buildEnhancedAreaViewOnlyViewModel } from './enhanced-area-view-only-view-model.js'
import {
  buildCreatedHedgerowViewOnlyViewModel,
  buildEnhancedHedgerowViewOnlyViewModel
} from './enhanced-hedgerow-view-only-view-model.js'
import { buildEnhancedWatercourseViewOnlyViewModel } from './enhanced-watercourse-view-only-view-model.js'
import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'
import { buildWatercourseViewOnlyViewModel } from './watercourse-view-only-view-model.js'
import { PI_DETAILS_HEADING } from './constants.js'
import { habitatDetailsDestination } from '../common/helpers/habitat-details-destination.js'
import { isValidHabitatRef } from '../common/helpers/habitat-ref.js'
import {
  isRefEditable,
  retainedRefEditFields,
  saveRetainedRef
} from './retained-ref-edit.js'
import {
  normaliseRetentionCategory,
  RETENTION_CREATED,
  RETENTION_ENHANCED
} from './retention.js'

const uploadType = HABITAT_UPLOAD_TYPES.postIntervention

// Feature-type discriminators returned by the PI feature endpoint.
const AREA_HABITAT_TYPE = 'habitat'
const HEDGEROW_TYPE = 'hedgerow'
const WATERCOURSE_TYPE = 'watercourse'

// Created/Enhanced area habitats use a two-section layout keyed by retention.
const AREA_RETENTION_PAGES = new Map([
  [
    RETENTION_ENHANCED,
    {
      template: 'habitat-details/pi-habitat-details-enhanced',
      buildViewModel: buildEnhancedAreaViewOnlyViewModel
    }
  ],
  [
    RETENTION_CREATED,
    {
      template: 'habitat-details/pi-habitat-details-created',
      buildViewModel: buildCreatedAreaViewOnlyViewModel
    }
  ]
])

// Created/Enhanced hedgerows also use a two-section layout, keyed by
// retention.
const HEDGEROW_RETENTION_PAGES = new Map([
  [
    RETENTION_ENHANCED,
    {
      template: 'habitat-details/pi-hedgerow-details-enhanced',
      buildViewModel: buildEnhancedHedgerowViewOnlyViewModel
    }
  ],
  [
    RETENTION_CREATED,
    {
      template: 'habitat-details/pi-hedgerow-details-enhanced',
      buildViewModel: buildCreatedHedgerowViewOnlyViewModel
    }
  ]
])

// Created/Enhanced watercourses use a two-section layout keyed by retention.
const WATERCOURSE_RETENTION_PAGES = new Map([
  [
    RETENTION_ENHANCED,
    {
      template: 'habitat-details/pi-watercourse-details-enhanced',
      buildViewModel: buildEnhancedWatercourseViewOnlyViewModel
    }
  ],
  [
    RETENTION_CREATED,
    {
      template: 'habitat-details/pi-watercourse-details-created',
      buildViewModel: buildCreatedWatercourseViewOnlyViewModel
    }
  ]
])

// Feature types that swap in a retention-specific, two-section page for
// some retention categories rather than always using the single-list page.
const RETENTION_VIEW_ONLY_PAGES = new Map([
  [AREA_HABITAT_TYPE, AREA_RETENTION_PAGES],
  [HEDGEROW_TYPE, HEDGEROW_RETENTION_PAGES],
  [WATERCOURSE_TYPE, WATERCOURSE_RETENTION_PAGES]
])

// The details page for each feature type. Each keeps its own template — they
// share chrome via layouts/pi-view-only-sections-page.njk and differ in the
// rows they show. Created/Enhanced area, hedgerow and watercourse add a second
// section (BMD-845); the Retained pages carry the reference input (BMD-1180).
const VIEW_ONLY_PAGES = new Map([
  [
    AREA_HABITAT_TYPE,
    {
      template: 'habitat-details/pi-habitat-details',
      buildViewModel: buildAreaViewOnlyViewModel
    }
  ],
  [
    HEDGEROW_TYPE,
    {
      template: 'habitat-details/pi-hedgerow-details',
      buildViewModel: buildHedgerowViewOnlyViewModel
    }
  ],
  [
    WATERCOURSE_TYPE,
    {
      template: 'habitat-details/pi-watercourse-details',
      buildViewModel: buildWatercourseViewOnlyViewModel
    }
  ]
])

const UNSUPPORTED_MESSAGE =
  'Individual tree and IGGI features are not yet supported in this view.'

const DEFAULT_PROJECT_NAME = 'Project'

// The backend's MAX_HABITAT_REF_LENGTH (validation/geopackage/habitat-ref-check.js).
const MAX_REF_LENGTH = 100

/**
 * A ref as the backend stores it since BMD-1058: as text, trimmed, cut to
 * MAX_REF_LENGTH characters and trimmed again (the backend's
 * cleanHabitatRef). A baseline saved before then may hold ' H001', 12 or a
 * longer ref, so both sides are compared cleaned. Null when there is none.
 */
function comparableRef(ref) {
  if (typeof ref !== 'string' && typeof ref !== 'number') {
    return null
  }
  const cleaned = Array.from(String(ref).trim())
    .slice(0, MAX_REF_LENGTH)
    .join('')
    .trimEnd()
  return cleaned === '' ? null : cleaned
}

/**
 * Resolve the baseline feature that corresponds to a post-intervention parcel.
 * Baseline and PI are separate uploads with independent featureIds, so the
 * only stable join key is the parcel ref. Returns null when no baseline has
 * been uploaded or no baseline feature shares the ref.
 */
function resolveBaselineFeatureId(project, ref) {
  const wanted = comparableRef(ref)
  if (wanted) {
    const baseline = project?.project?.baseline
    const candidates = [
      ...(baseline?.habitats ?? []),
      ...(baseline?.trees ?? []),
      ...(baseline?.hedgerows ?? []),
      ...(baseline?.watercourses ?? [])
    ]
    const match = candidates.find(
      (feature) => comparableRef(feature.ref) === wanted
    )
    return match?.featureId ?? null
  } else {
    return null
  }
}

/**
 * @param {string} type
 * @param {string|null} retentionCategory
 */
function resolveViewOnlyPage(type, retentionCategory) {
  const retentionPage =
    RETENTION_VIEW_ONLY_PAGES.get(type)?.get(retentionCategory)
  return retentionPage ?? VIEW_ONLY_PAGES.get(type)
}

function postInterventionBackHref(projectId, type, returnUrl) {
  const destination = habitatDetailsDestination(
    projectId,
    type,
    'postIntervention'
  )
  return isSafeRelativePath(returnUrl) &&
    (returnUrl === destination || returnUrl.startsWith(`${destination}#`))
    ? returnUrl
    : destination
}

function renderUnsupportedFeature(
  h,
  { projectId, projectName, type, returnUrl }
) {
  return h.view('habitat-details/pi-feature-unsupported', {
    pageTitle: PI_DETAILS_HEADING,
    heading: PI_DETAILS_HEADING,
    caption: projectName,
    message: UNSUPPORTED_MESSAGE,
    backHref: postInterventionBackHref(projectId, type, returnUrl)
  })
}

/**
 * Render the details page for one post-intervention feature. A Retained area
 * habitat, hedgerow or watercourse gets the reference form (BMD-1180);
 * `submittedRef` is set when a save of it was refused.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {{ projectId: string, featureId: string, returnUrl?: string, submittedRef?: string }} params
 */
async function renderDetailsPage(
  request,
  h,
  { projectId, featureId, returnUrl, submittedRef }
) {
  const [{ type, feature }, project] = await Promise.all([
    fetchFeature(request, uploadType, projectId, featureId),
    fetchProject(request, projectId)
  ])
  const projectName = project?.project?.name ?? DEFAULT_PROJECT_NAME

  // Normalise the feature-root retention category so a "1. Enhanced" list
  // prefix or a missing value resolves consistently for every view-only page.
  const retentionCategory = normaliseRetentionCategory(
    feature.retentionCategory
  )
  const page = resolveViewOnlyPage(type, retentionCategory)
  if (!page) {
    // Trees, IGGIs and any new feature type without a view-only page.
    return renderUnsupportedFeature(h, {
      projectId,
      projectName,
      type,
      returnUrl
    })
  }
  const viewModel = page.buildViewModel(
    { ...feature, retentionCategory },
    {
      projectId,
      projectName,
      baselineFeatureId: resolveBaselineFeatureId(project, feature.ref)
    }
  )
  const backHref = postInterventionBackHref(projectId, type, returnUrl)
  const refEditFields = isRefEditable(type, retentionCategory)
    ? retainedRefEditFields({
        type,
        feature,
        projectId,
        featureId,
        returnUrl,
        cancelHref: backHref,
        submittedRef
      })
    : {}
  return h.view(page.template, { ...viewModel, ...refEditFields, backHref })
}

const getController = {
  options: {
    validate: {
      query: Joi.object({
        featureId: Joi.string().uuid().required(),
        projectId: Joi.string().uuid().required(),
        returnUrl: Joi.string().allow('').optional()
      })
    }
  },
  handler(request, h) {
    const { featureId, projectId, returnUrl } = request.query
    return renderDetailsPage(request, h, { projectId, featureId, returnUrl })
  }
}

// Saves the reference of a Retained area habitat, hedgerow or watercourse
// (BMD-1180) — the one thing editable on those pages. Nothing else on a
// post-intervention details page posts here.
const postController = {
  options: {
    validate: {
      payload: Joi.object({
        projectId: Joi.string().uuid().required(),
        featureId: Joi.string().uuid().required(),
        ref: Joi.string().allow('').required(),
        returnUrl: Joi.string().allow('').optional(),
        crumb: Joi.string().optional()
      })
    }
  },
  async handler(request, h) {
    const { projectId, featureId, ref, returnUrl } = request.payload

    if (!isValidHabitatRef(ref)) {
      const response = await renderDetailsPage(request, h, {
        projectId,
        featureId,
        returnUrl,
        submittedRef: ref
      })
      return response.code(statusCodes.badRequest)
    }

    const { type } = await saveRetainedRef(request, {
      projectId,
      featureId,
      ref
    })
    return h.redirect(postInterventionBackHref(projectId, type, returnUrl))
  }
}

export { getController, postController }
