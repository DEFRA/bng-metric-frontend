import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { _resetReferenceCache as resetAreaReferenceCache } from './strategies/area.js'
import { _resetReferenceCache as resetHedgerowReferenceCache } from './strategies/hedgerow.js'
import { getStrategy } from './strategies/index.js'

// Re-exported so tests can clear the per-strategy in-process reference caches
// between scenarios without needing to know which strategy owns which cache.
export function _resetReferenceCache() {
  resetAreaReferenceCache()
  resetHedgerowReferenceCache()
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
// types — the backend enforces strict per-type rules. BMD-501 will wire up
// the per-type strategy on save; for BMD-500 (page load only) we keep the
// area POST shape so the existing area Save journey continues to work.
export const postController = {
  options: {
    validate: {
      payload: Joi.object({
        projectId: Joi.string().uuid().required(),
        featureId: Joi.string().uuid().required(),
        broadHabitat: Joi.string().allow('').optional(),
        habitatType: Joi.string().allow('').optional(),
        condition: Joi.string().allow('').optional(),
        crumb: Joi.string().optional()
      })
    }
  },
  async handler(request, h) {
    const { projectId, featureId, broadHabitat, habitatType, condition } =
      request.payload

    const { res } = await wreck.put(
      `${backendUrl}/projects/${projectId}/habitats/${featureId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          broadType: broadHabitat || null,
          habitatType: habitatType || null,
          condition: condition || null
        })
      }
    )

    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to save habitat')
    }

    return h.redirect(
      `/projects/${projectId}/habitat-list#habitat-${featureId}`
    )
  }
}

// Thin proxy to the backend's /reference/conditions endpoint so the client
// JS can refresh condition options on habitat-type change without crossing
// origins. Read-only; auth + role check sit on the route.
export const conditionsProxyController = {
  options: {
    validate: {
      query: Joi.object({
        habitatType: Joi.string().min(1).required(),
        featureType: Joi.string().valid('habitat', 'hedgerow').optional()
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
