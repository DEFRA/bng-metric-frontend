import Boom from '@hapi/boom'
import Joi from 'joi'
import { statusCodes } from '../common/constants.js'

import {
  fetchFeature,
  fetchProject
} from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { isServiceTemplateDocument } from '../common/helpers/service-template.js'
import { VERTICAL_HABITAT_TYPE } from '../common/helpers/vertical-habitats.js'
import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'
import { buildCreatedWatercourseViewOnlyViewModel } from './created-watercourse-view-only-view-model.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'
import { buildEnhancedAreaViewOnlyViewModel } from './enhanced-area-view-only-view-model.js'
import {
  buildCreatedHedgerowViewOnlyViewModel,
  buildEnhancedHedgerowViewOnlyViewModel
} from './enhanced-hedgerow-view-only-view-model.js'
import { buildEnhancedWatercourseViewOnlyViewModel } from './enhanced-watercourse-view-only-view-model.js'
import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'
import { buildWatercourseViewOnlyViewModel } from './watercourse-view-only-view-model.js'
import {
  HABITAT_REF_ERROR,
  HABITAT_REF_IN_USE_ERROR,
  isRefUnchanged,
  isValidHabitatRef
} from '../common/helpers/habitat-ref.js'
import { PI_DETAILS_HEADING, MAX_REF_LENGTH } from './constants.js'
import { postInterventionBackHref } from './navigation.js'
import {
  buildCreatedAreaEditViewModel,
  createdAreaPayloadSchema,
  CREATED_EDIT_KINDS,
  createdHedgerowPayloadSchema,
  createdReferenceForFeature,
  saveCreatedArea,
  validateCreatedArea
} from './created-area-edit.js'
import {
  isRefEditable,
  retainedRefEditFields,
  retainedRefPayloadSchema,
  saveRetainedRef
} from './retained-ref-edit.js'
import {
  featureRetentionCategory,
  RETENTION_CREATED,
  RETENTION_ENHANCED
} from './retention.js'

const uploadType = HABITAT_UPLOAD_TYPES.postIntervention

// Feature-type discriminators returned by the PI feature endpoint.
const AREA_HABITAT_TYPE = 'habitat'
const HEDGEROW_TYPE = 'hedgerow'
const CREATED_EDIT_TYPES = [AREA_HABITAT_TYPE, HEDGEROW_TYPE]
const WATERCOURSE_TYPE = 'watercourse'

// Enhanced areas use the view-only layout; Created areas use the edit page.
const ENHANCED_AREA_PAGE = {
  template: 'habitat-details/pi-habitat-details-enhanced',
  buildViewModel: buildEnhancedAreaViewOnlyViewModel
}
const AREA_RETENTION_PAGES = new Map([[RETENTION_ENHANCED, ENHANCED_AREA_PAGE]])

// A vertical area habitat uses the area pages, view-only whatever its
// retention: it cannot be edited after intervention yet. A Created one shows
// its timing and difficulty, as a Created area habitat's edit page does.
const VERTICAL_RETENTION_PAGES = new Map([
  [RETENTION_ENHANCED, ENHANCED_AREA_PAGE],
  [
    RETENTION_CREATED,
    {
      template: 'habitat-details/pi-habitat-details-enhanced',
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
  [VERTICAL_HABITAT_TYPE, VERTICAL_RETENTION_PAGES],
  [HEDGEROW_TYPE, HEDGEROW_RETENTION_PAGES],
  [WATERCOURSE_TYPE, WATERCOURSE_RETENTION_PAGES]
])

// The read-only details page for each feature type. Each keeps its own
// template — they share chrome via layouts/pi-view-only-sections-page.njk and
// differ in the rows they show (BMD-845).
const AREA_VIEW_ONLY_PAGE = {
  template: 'habitat-details/pi-habitat-details',
  buildViewModel: buildAreaViewOnlyViewModel
}

const VIEW_ONLY_PAGES = new Map([
  [AREA_HABITAT_TYPE, AREA_VIEW_ONLY_PAGE],
  [VERTICAL_HABITAT_TYPE, AREA_VIEW_ONLY_PAGE],
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

// The baseline layer a post-intervention feature of each type is joined to.
const BASELINE_LAYER_BY_TYPE = new Map([
  [AREA_HABITAT_TYPE, 'habitats'],
  [VERTICAL_HABITAT_TYPE, 'verticalHabitats'],
  ['tree', 'trees'],
  [HEDGEROW_TYPE, 'hedgerows'],
  [WATERCOURSE_TYPE, 'watercourses']
])

// The values a post-intervention row's `baseline` snapshot copies from its
// parcel, which tell parcels sharing a ref apart (as the backend's re-sync does).
const SNAPSHOT_FIELDS = ['type', 'broadType', 'condition']

function matchesSnapshot(candidate, snapshot) {
  return SNAPSHOT_FIELDS.every(
    (field) =>
      !Object.hasOwn(candidate, field) || candidate[field] === snapshot?.[field]
  )
}

/**
 * Resolve the baseline feature that corresponds to a post-intervention parcel
 * of a legacy project. Baseline and PI are separate uploads with independent
 * featureIds, so the only stable join key is the parcel ref, matched within
 * the feature's own layer: a hedgerow and an area habitat may share a ref.
 * Where an import left several parcels on the ref, the one the row's baseline
 * snapshot describes wins, else the first. Returns null when no baseline has
 * been uploaded or no baseline feature in the layer shares the ref.
 *
 * @param {object} project
 * @param {string} type the feature type from the PI feature endpoint
 * @param {object} feature the post-intervention feature
 * @returns {string|null}
 */
function resolveBaselineFeatureId(project, type, feature) {
  const wanted = comparableRef(feature.ref)
  const layer = BASELINE_LAYER_BY_TYPE.get(type)
  if (!wanted || !layer) {
    return null
  }
  const candidates = (project?.project?.baseline?.[layer] ?? []).filter(
    (candidate) => comparableRef(candidate.ref) === wanted
  )
  const described = candidates.filter((candidate) =>
    matchesSnapshot(candidate, feature.baseline)
  )
  const match = described.length === 1 ? described[0] : candidates[0]
  return match?.featureId ?? null
}

const BASELINE_LAYERS = [
  'habitats',
  'verticalHabitats',
  'trees',
  'hedgerows',
  'watercourses'
]

/**
 * The baseline feature a BNG Service template post-intervention feature names
 * as its parent, whatever its Retention Category: the one it continues,
 * enhances, or degrades by being Created over it (BMD-1083). The backend links
 * it by the parent_uuid in the file, so refs play no part: a feature with no
 * parentFeatureId has no baseline link, and neither does one whose parent the
 * baseline no longer holds.
 */
function parentBaselineFeatureId(project, feature, layers = BASELINE_LAYERS) {
  const parentId = feature.parentFeatureId
  if (!parentId) {
    return null
  }
  const baseline = project?.project?.baseline
  const exists = layers.some((layer) =>
    baseline?.[layer]?.some((f) => f.featureId === parentId)
  )
  return exists ? parentId : null
}

function isServiceTemplateProject(project) {
  return isServiceTemplateDocument(project?.project?.postIntervention)
}

function viewOnlyBaselineFeatureId(project, type, feature) {
  if (isServiceTemplateProject(project)) {
    return parentBaselineFeatureId(project, feature)
  }
  return resolveBaselineFeatureId(project, type, feature)
}

function createdBaselineFeatureId(project, type, feature) {
  if (
    isServiceTemplateProject(project) ||
    Object.hasOwn(feature, 'parentFeatureId')
  ) {
    const layer = CREATED_EDIT_KINDS[type].savePath
    return parentBaselineFeatureId(project, feature, [layer])
  }
  return resolveBaselineFeatureId(project, type, feature)
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

async function loadCreationReferenceForFeature(type, feature) {
  try {
    const reference = await CREATED_EDIT_KINDS[type].loadReference()
    return createdReferenceForFeature(reference, feature)
  } catch (error) {
    if (
      type === HEDGEROW_TYPE &&
      error.output?.statusCode === statusCodes.notFound
    ) {
      return null
    }
    throw error
  }
}

/**
 * Render a Created area habitat or hedgerow: its edit page, or the read-only
 * page for a hedgerow while the backend reference endpoint is not deployed.
 */
async function renderCreatedFeature(
  h,
  { type, feature, project, projectId, projectName, returnUrl }
) {
  const baselineFeatureId = createdBaselineFeatureId(project, type, feature)
  const reference = await loadCreationReferenceForFeature(type, feature)
  if (!reference) {
    return h.view('habitat-details/pi-hedgerow-details-enhanced', {
      ...buildCreatedHedgerowViewOnlyViewModel(feature, {
        projectId,
        projectName,
        baselineFeatureId
      }),
      backHref: postInterventionBackHref(projectId, type, returnUrl)
    })
  }
  return h.view(
    'habitat-details/pi-habitat-details-created-edit',
    buildCreatedAreaEditViewModel(feature, reference, {
      projectId,
      projectName,
      baselineFeatureId,
      returnUrl
    })
  )
}

/**
 * Render the details page for one post-intervention feature. A Created area
 * habitat or hedgerow gets its edit page (BMD-1048, BMD-1049); a Retained area habitat, hedgerow or
 * watercourse gets the reference form (BMD-1180), with `submittedRef` and
 * `refusal` set when a save of it was refused.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {{ projectId: string, featureId: string, returnUrl?: string, submittedRef?: string, refusal?: { summary: string, inline: string } }} params
 */
async function renderDetailsPage(
  request,
  h,
  { projectId, featureId, returnUrl, submittedRef, refusal }
) {
  const [{ type, feature }, project] = await Promise.all([
    fetchFeature(request, uploadType, projectId, featureId),
    fetchProject(request, projectId)
  ])
  const projectName = project?.project?.name ?? DEFAULT_PROJECT_NAME

  // Normalise the retention category so a "1. Enhanced" list prefix, a
  // category stored under `baseline`, or a missing value resolves consistently
  // for every page.
  const retentionCategory = featureRetentionCategory(feature)
  if (
    CREATED_EDIT_TYPES.includes(type) &&
    retentionCategory === RETENTION_CREATED
  ) {
    return renderCreatedFeature(h, {
      type,
      feature,
      project,
      projectId,
      projectName,
      returnUrl
    })
  }
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
      baselineFeatureId: viewOnlyBaselineFeatureId(project, type, feature)
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
        submittedRef,
        refusal
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

const createdPayloadSchema = Joi.alternatives().try(
  createdAreaPayloadSchema,
  createdHedgerowPayloadSchema
)

/**
 * Check a form's payload against its own schema, as a route's validation
 * would: an unexpected or missing field is a 400.
 */
function validatedPayload(schema, payload) {
  const { error, value } = schema.validate(payload)
  if (error) {
    throw Boom.badRequest(error.message)
  }
  return value
}

/** Save a Created area habitat's or hedgerow's details (BMD-1048, BMD-1049). */
async function saveCreatedDetails(request, h, { type, feature, payload }) {
  const { projectId, returnUrl, ...values } = validatedPayload(
    createdPayloadSchema,
    payload
  )
  delete values.featureId
  if (type === AREA_HABITAT_TYPE && !Object.hasOwn(values, 'broadHabitat')) {
    throw Boom.badRequest('Broad habitat field is required for area edits')
  }
  const reference = await loadCreationReferenceForFeature(type, feature)
  if (!reference) {
    throw Boom.serverUnavailable('Hedgerow editing is temporarily unavailable')
  }
  const errors = validateCreatedArea(values, reference)
  if (Object.keys(errors).length) {
    const project = await fetchProject(request, projectId)
    return h.view(
      'habitat-details/pi-habitat-details-created-edit',
      buildCreatedAreaEditViewModel(
        feature,
        reference,
        {
          projectId,
          projectName: project?.project?.name ?? DEFAULT_PROJECT_NAME,
          baselineFeatureId: createdBaselineFeatureId(project, type, feature),
          returnUrl
        },
        values,
        errors
      )
    )
  }
  await saveCreatedArea(request, values, CREATED_EDIT_KINDS[type])
  return h.redirect(postInterventionBackHref(projectId, type, returnUrl))
}

/**
 * Save a Retained habitat's reference (BMD-1180). As on the baseline form, a
 * reference left as stored is neither checked nor sent: it may be one that
 * would not pass today, and the backend would trim or cut it, renaming the
 * habitat unasked.
 */
async function saveRetainedReference(request, h, { type, feature, payload }) {
  const { projectId, featureId, habitatRef, returnUrl } = validatedPayload(
    retainedRefPayloadSchema,
    payload
  )
  if (isRefUnchanged(habitatRef, feature.ref)) {
    return h.redirect(postInterventionBackHref(projectId, type, returnUrl))
  }
  const showRefused = async (refusal) => {
    const response = await renderDetailsPage(request, h, {
      projectId,
      featureId,
      returnUrl,
      submittedRef: habitatRef,
      refusal
    })
    return response.code(statusCodes.badRequest)
  }

  if (!isValidHabitatRef(habitatRef)) {
    return showRefused(HABITAT_REF_ERROR)
  }
  const saved = await saveRetainedRef(request, {
    projectId,
    featureId,
    ref: habitatRef
  })
  if (saved.refInUse) {
    return showRefused(HABITAT_REF_IN_USE_ERROR)
  }
  if (saved.refInvalid) {
    return showRefused(HABITAT_REF_ERROR)
  }
  return h.redirect(postInterventionBackHref(projectId, saved.type, returnUrl))
}

// Both editable post-intervention forms post here: the Created details
// (BMD-1048, BMD-1049) and a Retained habitat's reference (BMD-1180). The habitat being
// saved decides which, and each form's payload is checked against its own
// schema. Every other details page is read-only.
const postController = {
  options: {
    validate: {
      payload: Joi.object({
        projectId: Joi.string().uuid().required(),
        featureId: Joi.string().uuid().required()
      }).unknown(true)
    }
  },
  async handler(request, h) {
    const { projectId, featureId } = request.payload
    const { type, feature } = await fetchFeature(
      request,
      uploadType,
      projectId,
      featureId
    )
    const retentionCategory = featureRetentionCategory(feature)
    if (
      CREATED_EDIT_TYPES.includes(type) &&
      retentionCategory === RETENTION_CREATED
    ) {
      return saveCreatedDetails(request, h, {
        type,
        feature,
        payload: request.payload
      })
    }
    if (isRefEditable(type, retentionCategory)) {
      return saveRetainedReference(request, h, {
        type,
        feature,
        payload: request.payload
      })
    }
    throw Boom.notImplemented(
      'Saving this post-intervention feature is not implemented'
    )
  }
}

export { getController, postController }
