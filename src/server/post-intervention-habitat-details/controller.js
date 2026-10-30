import Boom from '@hapi/boom'
import Joi from 'joi'

import {
  fetchFeature,
  fetchProject
} from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { isServiceTemplateDocument } from '../common/helpers/service-template.js'
import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'
import { buildCreatedWatercourseViewOnlyViewModel } from './created-watercourse-view-only-view-model.js'
import { buildEnhancedAreaViewOnlyViewModel } from './enhanced-area-view-only-view-model.js'
import {
  buildCreatedHedgerowViewOnlyViewModel,
  buildEnhancedHedgerowViewOnlyViewModel
} from './enhanced-hedgerow-view-only-view-model.js'
import { buildEnhancedWatercourseViewOnlyViewModel } from './enhanced-watercourse-view-only-view-model.js'
import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'
import { buildWatercourseViewOnlyViewModel } from './watercourse-view-only-view-model.js'
import { PI_DETAILS_HEADING, MAX_REF_LENGTH } from './constants.js'
import { postInterventionBackHref } from './navigation.js'
import {
  buildCreatedAreaEditViewModel,
  createdAreaPayloadSchema,
  loadCreatedAreaReference,
  saveCreatedArea,
  validateCreatedArea
} from './created-area-edit.js'
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

// Enhanced areas use the view-only layout; Created areas use the edit page.
const AREA_RETENTION_PAGES = new Map([
  [
    RETENTION_ENHANCED,
    {
      template: 'habitat-details/pi-habitat-details-enhanced',
      buildViewModel: buildEnhancedAreaViewOnlyViewModel
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

// The read-only details page for each feature type. Each keeps its own
// template — they share chrome via layouts/pi-view-only-page.njk (or the
// sections layout for Created/Enhanced area, Created/Enhanced hedgerow, and
// Created/Enhanced watercourse) and differ in the rows they show. Those
// retention categories use a two-section layout (BMD-845); other categories
// keep the single-list page for now.
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
 * Resolve the baseline feature that corresponds to a post-intervention parcel
 * of a legacy project. Baseline and PI are separate uploads with independent
 * featureIds, so the only stable join key is the parcel ref. Returns null when no baseline has
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

const BASELINE_LAYERS = ['habitats', 'trees', 'hedgerows', 'watercourses']

/**
 * The baseline feature a BNG Service template post-intervention feature names
 * as its parent, whatever its Retention Category: the one it continues,
 * enhances, or degrades by being Created over it (BMD-1083). The backend links
 * it by the parent_uuid in the file, so refs play no part: a feature with no
 * parentFeatureId has no baseline link, and neither does one whose parent the
 * baseline no longer holds.
 */
function parentBaselineFeatureId(project, feature) {
  const parentId = feature.parentFeatureId
  if (!parentId) {
    return null
  }
  const baseline = project?.project?.baseline
  const exists = BASELINE_LAYERS.some((layer) =>
    baseline?.[layer]?.some((f) => f.featureId === parentId)
  )
  return exists ? parentId : null
}

function isServiceTemplateProject(project) {
  return isServiceTemplateDocument(project?.project?.postIntervention)
}

function viewOnlyBaselineFeatureId(project, feature) {
  if (isServiceTemplateProject(project)) {
    return parentBaselineFeatureId(project, feature)
  }
  return resolveBaselineFeatureId(project, feature.ref)
}

function createdBaselineFeatureId(project, feature) {
  if (isServiceTemplateProject(project)) {
    return parentBaselineFeatureId(project, feature)
  }
  if (Object.hasOwn(feature, 'parentFeatureId')) {
    const parentId = feature.parentFeatureId
    const exists = project?.project?.baseline?.habitats?.some(
      (f) => f.featureId === parentId
    )
    return exists ? parentId : null
  }
  return resolveBaselineFeatureId(project, feature.ref)
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
  async handler(request, h) {
    const { featureId, projectId, returnUrl } = request.query
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
    if (type === AREA_HABITAT_TYPE && retentionCategory === RETENTION_CREATED) {
      const reference = await loadCreatedAreaReference()
      return h.view(
        'habitat-details/pi-habitat-details-created-edit',
        buildCreatedAreaEditViewModel(feature, reference, {
          projectId,
          projectName,
          baselineFeatureId: createdBaselineFeatureId(project, feature),
          returnUrl
        })
      )
    }
    const page = resolveViewOnlyPage(type, retentionCategory)
    if (page) {
      const featureWithIntervention = {
        ...feature,
        retentionCategory
      }
      const viewModel = page.buildViewModel(featureWithIntervention, {
        projectId,
        projectName,
        baselineFeatureId: viewOnlyBaselineFeatureId(project, feature)
      })
      return h.view(page.template, {
        ...viewModel,
        backHref: postInterventionBackHref(projectId, type, returnUrl)
      })
    } else {
      // Trees, IGGIs and any new feature type without a view-only page.
      return renderUnsupportedFeature(h, {
        projectId,
        projectName,
        type,
        returnUrl
      })
    }
  }
}

const postController = {
  options: {
    validate: { payload: createdAreaPayloadSchema }
  },
  async handler(request, h) {
    const { projectId, featureId, returnUrl, ...values } = request.payload
    const { type, feature } = await fetchFeature(
      request,
      uploadType,
      projectId,
      featureId
    )
    if (
      type !== AREA_HABITAT_TYPE ||
      normaliseRetentionCategory(feature.retentionCategory) !==
        RETENTION_CREATED
    ) {
      throw Boom.notImplemented(
        'Saving this post-intervention feature is not implemented'
      )
    }
    const reference = await loadCreatedAreaReference()
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
            baselineFeatureId: createdBaselineFeatureId(project, feature),
            returnUrl
          },
          values,
          errors
        )
      )
    }
    await saveCreatedArea(request, values)
    return h.redirect(
      postInterventionBackHref(projectId, AREA_HABITAT_TYPE, returnUrl)
    )
  }
}

export { getController, postController }
