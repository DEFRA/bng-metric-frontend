import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { _resetReferenceCache as resetAreaReferenceCache } from './strategies/area.js'
import { _resetReferenceCache as resetHedgerowReferenceCache } from './strategies/hedgerow.js'
import { _resetReferenceCache as resetWatercourseReferenceCache } from './strategies/watercourse.js'
import { getStrategy } from './strategies/index.js'

// Re-exported so tests can clear the per-strategy in-process reference caches
// between scenarios without needing to know which strategy owns which cache.
export function _resetReferenceCache() {
  resetAreaReferenceCache()
  resetHedgerowReferenceCache()
  resetWatercourseReferenceCache()
}

const backendUrl = config.get('backend').url.replace(/\/$/, '')

async function fetchProjectName(projectId) {
  try {
    const { payload } = await wreck.get(`${backendUrl}/projects/${projectId}`)
    return payload?.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

async function fetchFeature(projectId, featureId) {
  try {
    const { payload } = await wreck.get(
      `${backendUrl}/projects/${projectId}/features/${featureId}`
    )
    return payload
  } catch (err) {
    if (
      err.output?.statusCode === statusCodes.notFound ||
      err.data?.res?.statusCode === statusCodes.notFound
    ) {
      throw Boom.notFound(`Feature ${featureId} not found`)
    }
    throw err
  }
}

export const getController = {
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
    const [{ type, feature }, projectName] = await Promise.all([
      fetchFeature(projectId, featureId),
      fetchProjectName(projectId)
    ])

    const strategy = getStrategy(type)
    const reference = await strategy.loadReference(feature)
    const viewModel = strategy.buildViewModel(feature, reference, {
      projectId,
      projectName
    })

    return h.view('baseline-habitat-details/baseline-habitat-details', {
      pageTitle: `Biodiversity Net Gain - ${viewModel.headingPrefix} ${viewModel.habitatRef}`,
      heading: `${viewModel.headingPrefix} ${viewModel.habitatRef}`,
      caption: projectName,
      ...viewModel
    })
  }
}

// POST handler validation accepts the superset of fields across all feature
// types — the backend enforces strict per-type rules and reports back which
// type was actually edited so we can pick the right redirect anchor.
export const postController = {
  options: {
    validate: {
      payload: Joi.object({
        projectId: Joi.string().uuid().required(),
        featureId: Joi.string().uuid().required(),
        broadHabitat: Joi.string().allow('').optional(),
        habitatType: Joi.string().allow('').optional(),
        condition: Joi.string().allow('').optional(),
        watercourseEncroachment: Joi.string().allow('').optional(),
        riparianEncroachment: Joi.string().allow('').optional(),
        crumb: Joi.string().optional()
      })
    }
  },
  async handler(request, h) {
    const {
      projectId,
      featureId,
      broadHabitat,
      habitatType,
      condition,
      watercourseEncroachment,
      riparianEncroachment
    } = request.payload

    let payload
    try {
      const result = await wreck.put(
        `${backendUrl}/projects/${projectId}/features/${featureId}`,
        {
          headers: { 'Content-Type': 'application/json' },
          payload: JSON.stringify({
            broadType: broadHabitat || null,
            habitatType: habitatType || null,
            condition: condition || null,
            watercourseEncroachment: watercourseEncroachment || null,
            riparianEncroachment: riparianEncroachment || null
          })
        }
      )
      payload = result.payload
    } catch (err) {
      // Backend serializes concurrent edits on the same project with a row
      // lock and returns 409 when it can't be acquired. Surface that as a 409
      // to the user instead of a generic 5xx so they're prompted to retry.
      if (err?.output?.statusCode === statusCodes.conflict) {
        throw Boom.conflict('Another user is editing this project')
      }
      throw Boom.badGateway('Failed to save habitat')
    }

    return h.redirect(
      `/projects/${projectId}/baseline-habitat-list${habitatListAnchorFor(payload, featureId)}`
    )
  }
}

// Pick the URL fragment that lands the user on the right place in the
// habitat-list after a save. The unified PUT returns `{ type, feature }`.
//
// Hedgerow: AC6 asks for the Hedgerows tab to be opened (`#hedgerows`
//   matches the govuk-tabs panel id in habitat-list.njk).
// Area:     preserves the legacy `#habitat-{featureId}` row-anchor used
//   by the area save flow before BMD-501. The row IDs aren't rendered in
//   the template today so the anchor effectively scrolls to the top of
//   the page; a future ticket can wire up real row anchors.
// Missing type: defaults to the area branch so a malformed response still
//   lands somewhere sensible.
//
// `wreck-client.js` configures `json: true`, so `payload` is always the
// parsed response object here — no string/Buffer parsing needed.
function habitatListAnchorFor(payload, featureId) {
  if (payload?.type === 'hedgerow') {
    return '#hedgerows'
  }
  if (payload?.type === 'watercourse') {
    return '#watercourses'
  }
  return `#habitat-${featureId}`
}

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
