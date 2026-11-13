import Boom from '@hapi/boom'
import Joi from 'joi'
import { statusCodes } from '../common/constants.js'
import { pageErrorText } from '../common/error-text/error-text.js'

import {
  fetchFeature,
  fetchProject
} from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { VERTICAL_HABITAT_TYPE } from '../common/helpers/vertical-habitats.js'
import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'
import { buildEnhancedAreaViewOnlyViewModel } from './enhanced-area-view-only-view-model.js'
import { buildEnhancedHedgerowViewOnlyViewModel } from './enhanced-hedgerow-view-only-view-model.js'
import { buildEnhancedWatercourseViewOnlyViewModel } from './enhanced-watercourse-view-only-view-model.js'
import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'
import {
  buildRetainedTreeViewOnlyViewModel,
  buildTreeSectionsViewOnlyViewModel
} from './tree-view-only-view-model.js'
import { buildWatercourseViewOnlyViewModel } from './watercourse-view-only-view-model.js'
import {
  createdBaselineFeatureId,
  viewOnlyBaselineFeatureId
} from './baseline-feature-link.js'
import {
  HABITAT_REF_ERROR,
  HABITAT_REF_IN_USE_ERROR,
  habitatRefRefusal,
  isRefUnchanged
} from '../common/helpers/habitat-ref.js'
import {
  isStoredValueRefusal,
  storedValueRefusal
} from '../common/helpers/stored-value-refusal.js'
import {
  featureNotEditableRefusal,
  isFeatureNotEditableError
} from '../common/helpers/feature-not-editable-refusal.js'
import { isInvalidEnhancementError } from '../common/helpers/invalid-enhancement-refusal.js'
import { AREA_SECTIONS_TEMPLATE, PI_DETAILS_HEADING } from './constants.js'
import { postInterventionBackHref } from './navigation.js'
import {
  buildCreatedAreaEditViewModel,
  createdAreaPayloadSchema,
  CREATED_EDIT_KINDS,
  createdHedgerowPayloadSchema,
  createdWatercoursePayloadSchema,
  createdReferenceForFeature,
  saveCreatedArea,
  validateCreatedArea,
  withFixedBroadHabitat
} from './created-area-edit.js'
import {
  canRenameNow,
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
const WATERCOURSE_TYPE = 'watercourse'
const TREE_TYPE = 'tree'
const CREATED_EDIT_TYPES = new Set([
  AREA_HABITAT_TYPE,
  TREE_TYPE,
  HEDGEROW_TYPE,
  WATERCOURSE_TYPE
])
// The CREATED_EDIT_KINDS entry an Enhanced tree is edited as.
const ENHANCED_TREE_KIND = 'enhancedTree'

/**
 * The feature as its edit kind reads it: an Enhanced tree whose file left its
 * setting blank takes its baseline one, as the backend reads it.
 *
 * @param {string} kindKey
 * @param {object} feature
 * @returns {object}
 */
function editableFeature(kindKey, feature) {
  return CREATED_EDIT_KINDS[kindKey].normaliseFeature?.(feature) ?? feature
}

/**
 * The CREATED_EDIT_KINDS entry a post-intervention feature's details page
 * edits it as: a Created area habitat, tree, hedgerow or watercourse its own
 * type's, and an Enhanced tree the Enhanced tree's. Null for a feature whose
 * page is read-only or only renames it.
 *
 * @param {string} type
 * @param {string|null} retentionCategory
 * @returns {string|null}
 */
function editKindOf(type, retentionCategory) {
  if (CREATED_EDIT_TYPES.has(type) && retentionCategory === RETENTION_CREATED) {
    return type
  }
  if (type === TREE_TYPE && retentionCategory === RETENTION_ENHANCED) {
    return ENHANCED_TREE_KIND
  }
  return null
}

// The area habitat details templates, shared by vertical area habitats and
// individual trees: the single-section page, and the two-section page with
// time to target and difficulty.
const AREA_DETAILS_TEMPLATE = 'habitat-details/pi-habitat-details'

// Enhanced areas use the view-only layout; Created areas use the edit page.
const ENHANCED_AREA_PAGE = {
  template: AREA_SECTIONS_TEMPLATE,
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
      template: AREA_SECTIONS_TEMPLATE,
      buildViewModel: buildCreatedAreaViewOnlyViewModel
    }
  ]
])

// An individual tree uses the area layout with its size class and number of
// trees. A Created or an Enhanced one gets the edit page (editKindOf), and a
// Retained one the reference form. An Enhanced one falls back to this
// view-only page, with its timing and difficulty, while the backend does not
// serve the tree enhancement reference.
const TREE_RETENTION_PAGES = new Map([
  [
    RETENTION_ENHANCED,
    {
      template: AREA_SECTIONS_TEMPLATE,
      buildViewModel: buildTreeSectionsViewOnlyViewModel
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

// Enhanced watercourses use a two-section layout keyed by retention.
const WATERCOURSE_RETENTION_PAGES = new Map([
  [
    RETENTION_ENHANCED,
    {
      template: 'habitat-details/pi-watercourse-details-enhanced',
      buildViewModel: buildEnhancedWatercourseViewOnlyViewModel
    }
  ]
])

// Feature types that swap in a retention-specific, two-section page for
// some retention categories rather than always using the single-list page.
const RETENTION_VIEW_ONLY_PAGES = new Map([
  [AREA_HABITAT_TYPE, AREA_RETENTION_PAGES],
  [VERTICAL_HABITAT_TYPE, VERTICAL_RETENTION_PAGES],
  [TREE_TYPE, TREE_RETENTION_PAGES],
  [HEDGEROW_TYPE, HEDGEROW_RETENTION_PAGES],
  [WATERCOURSE_TYPE, WATERCOURSE_RETENTION_PAGES]
])

// The read-only details page for each feature type. Each keeps its own
// template — they share chrome via layouts/pi-view-only-sections-page.njk and
// differ in the rows they show (BMD-845).
const AREA_VIEW_ONLY_PAGE = {
  template: AREA_DETAILS_TEMPLATE,
  buildViewModel: buildAreaViewOnlyViewModel
}

const VIEW_ONLY_PAGES = new Map([
  [AREA_HABITAT_TYPE, AREA_VIEW_ONLY_PAGE],
  [VERTICAL_HABITAT_TYPE, AREA_VIEW_ONLY_PAGE],
  [
    TREE_TYPE,
    {
      template: AREA_DETAILS_TEMPLATE,
      buildViewModel: buildRetainedTreeViewOnlyViewModel
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

const UNSUPPORTED_BODY = pageErrorText('featureUnsupported').body

const DEFAULT_PROJECT_NAME = 'Project'

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
    body: UNSUPPORTED_BODY,
    backHref: postInterventionBackHref(projectId, type, returnUrl)
  })
}

async function loadCreationReferenceForFeature(kindKey, feature) {
  const kind = CREATED_EDIT_KINDS[kindKey]
  try {
    const reference = await kind.loadReference()
    return createdReferenceForFeature(reference, feature)
  } catch (error) {
    if (
      kind.optionalReference &&
      error.output?.statusCode === statusCodes.notFound
    ) {
      return null
    }
    throw error
  }
}

/**
 * Render a Created area habitat, tree, hedgerow or watercourse, or an
 * Enhanced tree: its edit page, or the read-only page for a tree or linear
 * feature while the backend reference endpoint is not deployed.
 */
async function renderCreatedFeature(
  h,
  { type, kindKey, feature, project, projectId, projectName, returnUrl }
) {
  const baselineFeatureId = createdBaselineFeatureId(project, type, feature)
  const kind = CREATED_EDIT_KINDS[kindKey]
  const reference = await loadCreationReferenceForFeature(kindKey, feature)
  if (!reference) {
    return h.view(kind.readOnlyTemplate, {
      ...kind.buildBase(
        { ...feature, retentionCategory: featureRetentionCategory(feature) },
        {
          projectId,
          projectName,
          baselineFeatureId
        }
      ),
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
 * habitat, tree, hedgerow or watercourse gets its edit page (BMD-1048, BMD-1049, BMD-1050); a Retained area habitat, tree,
 * hedgerow or watercourse gets the reference form (BMD-1180), with `submittedRef` and
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
  const kindKey = editKindOf(type, retentionCategory)
  if (kindKey) {
    return renderCreatedFeature(h, {
      type,
      kindKey,
      feature: editableFeature(kindKey, feature),
      project,
      projectId,
      projectName,
      returnUrl
    })
  }
  const page = resolveViewOnlyPage(type, retentionCategory)
  if (!page) {
    // IGGIs and any new feature type without a view-only page.
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
  const canRename = await canRenameNow(type, retentionCategory, {
    logger: request.logger
  })
  const refEditFields = canRename
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

const CREATED_PAYLOAD_SCHEMAS = {
  habitat: createdAreaPayloadSchema,
  tree: createdAreaPayloadSchema,
  [ENHANCED_TREE_KIND]: createdAreaPayloadSchema,
  hedgerow: createdHedgerowPayloadSchema,
  watercourse: createdWatercoursePayloadSchema
}

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

/** Save Created area, tree, hedgerow or watercourse details (BMD-1048/BMD-1049/BMD-1050), or an Enhanced tree's. */
async function saveCreatedDetails(
  request,
  h,
  { type, kindKey, feature, payload }
) {
  const kind = CREATED_EDIT_KINDS[kindKey]
  if (kind.hasBroadHabitat && !Object.hasOwn(payload, 'broadHabitat')) {
    throw Boom.badRequest('Broad habitat field is required for area edits')
  }
  const { projectId, returnUrl, ...posted } = validatedPayload(
    CREATED_PAYLOAD_SCHEMAS[kindKey],
    payload
  )
  const values = withFixedBroadHabitat(posted, kind)
  delete values.featureId
  const reference = await loadCreationReferenceForFeature(kindKey, feature)
  if (!reference) {
    throw Boom.serverUnavailable(
      `${kind.label} editing is temporarily unavailable`
    )
  }
  // Shows the page again with what the user chose, and why it was refused.
  const showRefused = async ({ errors = {}, refusal } = {}) => {
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
          returnUrl,
          refusal
        },
        values,
        errors
      )
    )
  }
  const fieldErrors = validateCreatedArea(values, reference)
  if (Object.keys(fieldErrors).length) {
    return showRefused({ errors: fieldErrors })
  }
  try {
    await saveCreatedArea(request, values, kind, feature)
  } catch (err) {
    // A value saved before the service checked text lengths and lists
    // refuses any save of the habitat, whatever was changed.
    if (isStoredValueRefusal(err)) {
      const response = await showRefused({ refusal: storedValueRefusal(err) })
      return response.code(statusCodes.badRequest)
    }
    // A stale page or a crafted post asking for a tree that is no longer a
    // tree: shown in the error summary, keeping what was chosen.
    if (isFeatureNotEditableError(err)) {
      const response = await showRefused({
        refusal: featureNotEditableRefusal()
      })
      return response.code(statusCodes.badRequest)
    }
    // A page that offered an Enhanced tree a target condition its baseline
    // tree no longer allows, such as after an edit to the baseline tree in
    // another tab: the condition is to blame.
    if (isInvalidEnhancementError(err) && kind.conditionError) {
      const response = await showRefused({
        errors: { condition: kind.conditionError }
      })
      return response.code(statusCodes.unprocessableEntity)
    }
    throw err
  }
  return h.redirect(postInterventionBackHref(projectId, type, returnUrl))
}

/**
 * Save a Retained habitat's reference (BMD-1180). As on the baseline form, a
 * reference left as stored is neither checked nor sent: it may be one that
 * would not pass today, and the backend would trim or refuse it. A changed
 * one that is too long is refused here, asking the user to shorten it.
 */
async function saveRetainedReference(request, h, { type, feature, payload }) {
  const { projectId, featureId, habitatRef, returnUrl } = validatedPayload(
    retainedRefPayloadSchema,
    payload
  )
  if (isRefUnchanged(habitatRef, feature.ref)) {
    return h.redirect(postInterventionBackHref(projectId, type, returnUrl))
  }
  const showRefused = async (refusalToShow) => {
    const response = await renderDetailsPage(request, h, {
      projectId,
      featureId,
      returnUrl,
      submittedRef: habitatRef,
      refusal: refusalToShow
    })
    return response.code(statusCodes.badRequest)
  }

  const refusal = habitatRefRefusal(habitatRef)
  if (refusal) {
    return showRefused(refusal)
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
  if (saved.storedValueRefusal) {
    return showRefused(saved.storedValueRefusal)
  }
  return h.redirect(postInterventionBackHref(projectId, saved.type, returnUrl))
}

// Both editable post-intervention forms post here: the Created details
// (BMD-1048, BMD-1049, BMD-1050) and a Retained habitat's reference (BMD-1180). The habitat being
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
    const kindKey = editKindOf(type, retentionCategory)
    if (kindKey) {
      return saveCreatedDetails(request, h, {
        type,
        kindKey,
        feature: editableFeature(kindKey, feature),
        payload: request.payload
      })
    }
    if (await canRenameNow(type, retentionCategory, { strict: true })) {
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
