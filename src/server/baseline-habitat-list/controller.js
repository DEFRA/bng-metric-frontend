import { config } from '../../config/config.js'
import { createHabitatListController } from '../common/helpers/habitat-list-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'

// BMD-546 spike: the client only sees the proxy URLs; the OS API key
// stays server-side and is used solely to gate map rendering (template
// hides the map block if the key is absent so dev/local works without).
export const getController = createHabitatListController(
  HABITAT_UPLOAD_TYPES.baseline,
  (request) => ({
    mapConfig: {
      stage: 'baseline',
      geometryUrl: `/api/projects/${request.params.id}/baseline/geometry`,
      postInterventionGeometryUrl: `/api/projects/${request.params.id}/post-intervention/geometry`,
      osStyleUrl: '/os-base-map/resources/styles?srs=3857',
      osApiKeyConfigured: Boolean(config.get('map.osApiKey'))
    }
  })
)
