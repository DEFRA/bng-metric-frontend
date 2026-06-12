import { config } from '../../config/config.js'
import { createHabitatListController } from '../common/helpers/habitat-list-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'

export const getController = createHabitatListController(
  HABITAT_UPLOAD_TYPES.postIntervention,
  (request) => ({
    mapConfig: {
      stage: 'postIntervention',
      geometryUrl: `/api/projects/${request.params.id}/baseline/geometry`,
      postInterventionGeometryUrl: `/api/projects/${request.params.id}/post-intervention/geometry`,
      osStyleUrl: '/os-base-map/resources/styles?srs=3857',
      osApiKeyConfigured: Boolean(config.get('map.osApiKey'))
    }
  })
)
