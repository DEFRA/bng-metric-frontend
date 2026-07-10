import {
  createHabitatDetailsControllers,
  fetchFeature,
  fetchProjectName
} from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'

const uploadType = HABITAT_UPLOAD_TYPES.postIntervention
const shared = createHabitatDetailsControllers(uploadType)

// Feature-type discriminators returned by the PI feature endpoint.
const AREA_HABITAT_TYPE = 'habitat'
const TREE_TYPE = 'tree'

const PI_DETAILS_HEADING = 'Post-intervention habitat details'
const AREAS_TAB_ANCHOR = '#area-habitats'
const UNSUPPORTED_MESSAGE =
  'Individual tree and IGGI features are not yet supported in this view.'

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
    const [{ type, feature }, projectName] = await Promise.all([
      fetchFeature(request, uploadType, projectId, featureId),
      fetchProjectName(request, projectId)
    ])

    // Retained area habitat: the view-only page this story delivers (BMD-608).
    if (type === AREA_HABITAT_TYPE) {
      return h.view(
        'habitat-details/pi-habitat-details',
        buildAreaViewOnlyViewModel(feature, { projectId, projectName })
      )
    }

    // Trees (and IGGIs, if ever reachable) are out of scope here.
    if (type === TREE_TYPE) {
      return renderUnsupportedFeature(h, { projectId, projectName })
    }

    // Hedgerows and watercourses keep their existing editable page until their
    // own view-only stories (BMD-723 / BMD-724) land.
    return shared.getController.handler(request, h)
  }
}

const { postController } = shared

export { getController, postController }
