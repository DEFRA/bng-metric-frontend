import {
  createHabitatDetailsControllers,
  fetchFeature,
  fetchProject
} from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'
import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'
import { buildWatercourseViewOnlyViewModel } from './watercourse-view-only-view-model.js'
import { AREAS_TAB_ANCHOR, PI_DETAILS_HEADING } from './constants.js'
import { isRetainedFeature } from './retention.js'

const uploadType = HABITAT_UPLOAD_TYPES.postIntervention
const shared = createHabitatDetailsControllers(uploadType)

// Feature-type discriminators returned by the PI feature endpoint.
const AREA_HABITAT_TYPE = 'habitat'
const TREE_TYPE = 'tree'
const HEDGEROW_TYPE = 'hedgerow'
const WATERCOURSE_TYPE = 'watercourse'

// The feature types that have a read-only details page. Each keeps its own
// template — they share their chrome via layouts/pi-view-only-page.njk and
// differ only in the rows they show. Retention is checked separately: only
// *retained* features are read-only, so a Created, Enhanced or Lost feature of
// one of these types still gets its editable form. A Map (not a plain object)
// so a feature type that collides with an Object prototype key cannot resolve
// to an inherited property.
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
  if (!ref) {
    return null
  }
  const baseline = project?.project?.baseline
  const candidates = [
    ...(baseline?.habitats ?? []),
    ...(baseline?.trees ?? []),
    ...(baseline?.hedgerows ?? []),
    ...(baseline?.watercourses ?? [])
  ]
  const match = candidates.find((feature) => feature.ref === ref)
  return match?.featureId ?? null
}

/**
 * The view-only page for a feature, or null when the feature keeps its editable
 * page.
 */
function resolveViewOnlyPage(type, feature) {
  if (!isRetainedFeature(feature)) {
    return null
  }
  return VIEW_ONLY_PAGES.get(type) ?? null
}

function renderUnsupportedFeature(h, { projectId, projectName }) {
  return h.view('habitat-details/pi-feature-unsupported', {
    pageTitle: `Biodiversity Net Gain - ${PI_DETAILS_HEADING}`,
    heading: PI_DETAILS_HEADING,
    caption: projectName,
    message: UNSUPPORTED_MESSAGE,
    backHref: `/projects/${projectId}/post-intervention-habitat-list${AREAS_TAB_ANCHOR}`
  })
}

const getController = {
  options: shared.getController.options,
  async handler(request, h) {
    const { featureId, projectId } = request.query
    const [{ type, feature }, project] = await Promise.all([
      fetchFeature(request, uploadType, projectId, featureId),
      fetchProject(request, projectId)
    ])
    const projectName = project?.project?.name ?? 'Project'

    // Retained area, hedgerow and watercourse habitats: the read-only pages.
    const page = resolveViewOnlyPage(type, feature)
    if (page) {
      return h.view(
        page.template,
        page.buildViewModel(feature, {
          projectId,
          projectName,
          baselineFeatureId: resolveBaselineFeatureId(project, feature.ref)
        })
      )
    }

    // Trees (and IGGIs, if ever reachable) are out of scope here.
    if (type === TREE_TYPE) {
      return renderUnsupportedFeature(h, { projectId, projectName })
    }

    // Everything else — Created, Enhanced and Lost features, plus any feature
    // type with no view-only page — keeps the existing editable page.
    return shared.getController.handler(request, h)
  }
}

const { postController } = shared

export { getController, postController }
