import Boom from '@hapi/boom'
import Joi from 'joi'

import {
  fetchFeature,
  fetchProject
} from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'
import { buildEnhancedAreaViewOnlyViewModel } from './enhanced-area-view-only-view-model.js'
import { buildEnhancedHedgerowViewOnlyViewModel } from './enhanced-hedgerow-view-only-view-model.js'
import { buildEnhancedWatercourseViewOnlyViewModel } from './enhanced-watercourse-view-only-view-model.js'
import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'
import { buildWatercourseViewOnlyViewModel } from './watercourse-view-only-view-model.js'
import { AREAS_TAB_ANCHOR, PI_DETAILS_HEADING } from './constants.js'
import { normaliseRetentionCategory, RETENTION_ENHANCED } from './retention.js'

const uploadType = HABITAT_UPLOAD_TYPES.postIntervention

// Feature-type discriminators returned by the PI feature endpoint.
const AREA_HABITAT_TYPE = 'habitat'
const HEDGEROW_TYPE = 'hedgerow'
const WATERCOURSE_TYPE = 'watercourse'

const ENHANCED_VIEW_ONLY_PAGES = new Map([
  [
    AREA_HABITAT_TYPE,
    {
      template: 'habitat-details/pi-habitat-details-enhanced',
      buildViewModel: buildEnhancedAreaViewOnlyViewModel
    }
  ],
  [
    HEDGEROW_TYPE,
    {
      template: 'habitat-details/pi-hedgerow-details-enhanced',
      buildViewModel: buildEnhancedHedgerowViewOnlyViewModel
    }
  ],
  [
    WATERCOURSE_TYPE,
    {
      template: 'habitat-details/pi-watercourse-details-enhanced',
      buildViewModel: buildEnhancedWatercourseViewOnlyViewModel
    }
  ]
])

// The read-only details page for each feature type. Each keeps its own
// template — they share chrome via layouts/pi-view-only-page.njk (or the
// sections layout for Enhanced area/watercourse) and differ in the rows they
// show. Enhanced area habitats and watercourses use a two-section layout;
// other retention categories keep the single-list page until their Enhanced
// variants land.
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

/**
 * Resolve the baseline feature that corresponds to a post-intervention parcel.
 * Baseline and PI are separate uploads with independent featureIds, so the
 * only stable join key is the parcel ref. Returns null when no baseline has
 * been uploaded or no baseline feature shares the ref.
 */
function resolveBaselineFeatureId(project, ref) {
  if (ref) {
    const baseline = project?.project?.baseline
    const candidates = [
      ...(baseline?.habitats ?? []),
      ...(baseline?.trees ?? []),
      ...(baseline?.hedgerows ?? []),
      ...(baseline?.watercourses ?? [])
    ]
    const match = candidates.find((feature) => feature.ref === ref)
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
  if (retentionCategory === RETENTION_ENHANCED) {
    return ENHANCED_VIEW_ONLY_PAGES.get(type) ?? VIEW_ONLY_PAGES.get(type)
  }
  return VIEW_ONLY_PAGES.get(type)
}

function renderUnsupportedFeature(h, { projectId, projectName }) {
  return h.view('habitat-details/pi-feature-unsupported', {
    pageTitle: PI_DETAILS_HEADING,
    heading: PI_DETAILS_HEADING,
    caption: projectName,
    message: UNSUPPORTED_MESSAGE,
    backHref: `/projects/${projectId}/post-intervention-habitat-list${AREAS_TAB_ANCHOR}`
  })
}

const getController = {
  options: {
    validate: {
      query: Joi.object({
        featureId: Joi.string().uuid().required(),
        projectId: Joi.string().uuid().required()
      })
    }
  },
  async handler(request, h) {
    const { featureId, projectId } = request.query
    const [{ type, feature }, project] = await Promise.all([
      fetchFeature(request, uploadType, projectId, featureId),
      fetchProject(request, projectId)
    ])
    const projectName = project?.project?.name ?? 'Project'

    // Normalise the feature-root retention category so a "1. Enhanced" list
    // prefix or a missing value resolves consistently for every view-only page.
    const retentionCategory = normaliseRetentionCategory(
      feature.retentionCategory
    )
    const page = resolveViewOnlyPage(type, retentionCategory)
    if (page) {
      const featureWithIntervention = {
        ...feature,
        retentionCategory
      }
      return h.view(
        page.template,
        page.buildViewModel(featureWithIntervention, {
          projectId,
          projectName,
          baselineFeatureId: resolveBaselineFeatureId(project, feature.ref)
        })
      )
    } else {
      // Trees, IGGIs and any new feature type without a view-only page.
      return renderUnsupportedFeature(h, { projectId, projectName })
    }
  }
}

// Every PI details page is read-only, so nothing renders a form that posts
// here any more. The route stays registered and answers 501 so a stale page
// or client gets an explicit "not implemented" rather than a 404.
const postController = {
  handler() {
    throw Boom.notImplemented(
      'Saving post-intervention habitat details is not implemented'
    )
  }
}

export { getController, postController }
