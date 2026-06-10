import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { createHabitatDetailsControllers } from '../common/helpers/habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { _resetReferenceCache as resetAreaReferenceCache } from './strategies/area.js'
import { _resetReferenceCache as resetHedgerowReferenceCache } from './strategies/hedgerow.js'
import { _resetReferenceCache as resetWatercourseReferenceCache } from './strategies/watercourse.js'

// Re-exported so tests can clear the per-strategy in-process reference caches
// between scenarios without needing to know which strategy owns which cache.
export function _resetReferenceCache() {
  resetAreaReferenceCache()
  resetHedgerowReferenceCache()
  resetWatercourseReferenceCache()
}

const backendUrl = config.get('backend').url.replace(/\/$/, '')

const { getController, postController } = createHabitatDetailsControllers(
  HABITAT_UPLOAD_TYPES.baseline
)

// Thin proxy to the backend's /reference/conditions endpoint so the client
// JS can refresh condition options on habitat-type change without crossing
// origins. Read-only; auth + role check sit on the route.
export const conditionsProxyController = {
  options: {
    validate: {
      query: Joi.object({
        habitatType: Joi.string().min(1).required(),
        featureType: Joi.string()
          .valid('habitat', 'hedgerow', 'watercourse')
          .optional()
      })
    }
  },
  async handler(request, _h) {
    const { habitatType, featureType } = request.query
    let url = `${backendUrl}/reference/conditions?habitatType=${encodeURIComponent(habitatType)}`
    if (featureType) {
      url += `&featureType=${encodeURIComponent(featureType)}`
    }
    const { res, payload } = await wreck.get(url)
    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to fetch habitat conditions')
    }
    return payload
  }
}

export { getController, postController }
