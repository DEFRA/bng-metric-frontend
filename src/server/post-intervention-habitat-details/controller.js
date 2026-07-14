import {
  createHabitatDetailsControllers,
  fetchFeature,
  fetchProject
} from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'
import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'
import { AREAS_TAB_ANCHOR, PI_DETAILS_HEADING } from './constants.js'

const uploadType = HABITAT_UPLOAD_TYPES.postIntervention
const shared = createHabitatDetailsControllers(uploadType)

// Feature-type discriminators returned by the PI feature endpoint.
const AREA_HABITAT_TYPE = 'habitat'
const TREE_TYPE = 'tree'
const HEDGEROW_TYPE = 'hedgerow'

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
    ...(baseline?.hedgerows ?? [])
  ]
  const match = candidates.find((feature) => feature.ref === ref)
  return match?.featureId ?? null
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

    // Retained area habitat: the read-only view-only page.
    if (type === AREA_HABITAT_TYPE) {
      return h.view(
        'habitat-details/pi-habitat-details',
        buildAreaViewOnlyViewModel(feature, {
          projectId,
          projectName,
          baselineFeatureId: resolveBaselineFeatureId(project, feature.ref)
        })
      )
    }

    // Retained hedgerow habitat: the read-only view-only page.
    if (type === HEDGEROW_TYPE) {
      return h.view(
        'habitat-details/pi-hedgerow-details',
        buildHedgerowViewOnlyViewModel(feature, {
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

    // Watercourses keep their existing editable page until their own view-only
    // page lands.
    return shared.getController.handler(request, h)
  }
}

const { postController } = shared

export { getController, postController }
