import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { backendRequest } from './auth/backend-request.js'
import { getStrategy } from '../../baseline-habitat-details/strategies/index.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

async function fetchProjectName(request, projectId) {
  try {
    const { payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}/projects/${projectId}`
    )
    return payload?.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

/**
 * Fetch the full project payload, or null when the request fails. Callers that
 * only need the name should use fetchProjectName; this is for callers that also
 * need the stored feature lists (e.g. resolving a baseline feature by ref).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} projectId
 * @returns {Promise<object|null>}
 */
async function fetchProject(request, projectId) {
  try {
    const { payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}/projects/${projectId}`
    )
    return payload ?? null
  } catch {
    return null
  }
}

async function fetchFeature(request, uploadType, projectId, featureId) {
  try {
    const { payload } = await backendRequest(
      request,
      'get',
      `${backendUrl}/${uploadType.backendFeaturePath(projectId, featureId)}`
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

function listHref(uploadType, projectId) {
  return `/projects/${projectId}/${uploadType.listRoute}`
}

function adaptListHref(href, uploadType, projectId) {
  return href
    .replace(
      `/projects/${projectId}/habitat-list`,
      listHref(uploadType, projectId)
    )
    .replace(
      `/projects/${projectId}/baseline-habitat-list`,
      listHref(uploadType, projectId)
    )
}

function habitatListAnchorFor(payload, featureId) {
  if (payload?.type === 'hedgerow') {
    return '#hedgerows'
  } else if (payload?.type === 'watercourse') {
    return '#watercourses'
  } else {
    return `#habitat-${featureId}`
  }
}

/**
 * Return a flattened feature shape that strategies can consume, promoting
 * `proposed.*` fields to top level while preserving the raw `proposed` and
 * `baseline` sub-objects for comparison rendering.
 *
 * @param {object} feature
 * @returns {object}
 */
export function normalizePostInterventionFeatureForDisplay(feature) {
  const proposed = feature.proposed ?? {}
  return {
    ...feature,
    ...proposed,
    baseline: feature.baseline,
    proposed: feature.proposed
  }
}

function buildSaveBody({
  broadHabitat,
  habitatType,
  condition,
  watercourseEncroachment,
  riparianEncroachment
}) {
  const body = {
    broadType: broadHabitat || null,
    habitatType: habitatType || null,
    condition: condition || null
  }
  // Only the watercourse form submits encroachment fields.
  if (watercourseEncroachment !== undefined) {
    body.watercourseEncroachment = watercourseEncroachment || null
  }
  if (riparianEncroachment !== undefined) {
    body.riparianEncroachment = riparianEncroachment || null
  }
  return body
}

function createGetController(uploadType) {
  return {
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
      const [{ type, feature: rawFeature }, projectName] = await Promise.all([
        fetchFeature(request, uploadType, projectId, featureId),
        fetchProjectName(request, projectId)
      ])

      const feature = uploadType.isPostIntervention
        ? normalizePostInterventionFeatureForDisplay(rawFeature)
        : rawFeature
      const strategy = getStrategy(type)
      const reference = await strategy.loadReference(feature)
      const viewModel = strategy.buildViewModel(feature, reference, {
        projectId,
        projectName
      })

      return h.view('habitat-details/habitat-details', {
        pageTitle: `Biodiversity Net Gain - ${viewModel.headingPrefix} ${viewModel.habitatRef}`,
        heading: `${viewModel.headingPrefix} ${viewModel.habitatRef}`,
        caption: projectName,
        ...viewModel,
        formAction: `/${uploadType.detailsRoute}`,
        detailsSectionHeading: uploadType.detailsSectionHeading,
        backHref: adaptListHref(viewModel.backHref, uploadType, projectId),
        cancelHref: adaptListHref(viewModel.cancelHref, uploadType, projectId)
      })
    }
  }
}

function createPostController(uploadType) {
  return {
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

      const body = buildSaveBody({
        broadHabitat,
        habitatType,
        condition,
        watercourseEncroachment,
        riparianEncroachment
      })

      let payload
      try {
        const result = await backendRequest(
          request,
          'put',
          `${backendUrl}/${uploadType.backendSavePath(projectId, featureId)}`,
          {
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify(body)
          }
        )
        payload = result.payload
      } catch (err) {
        if (err?.output?.statusCode === statusCodes.conflict) {
          throw Boom.conflict('Another user is editing this project')
        }
        throw Boom.badGateway('Failed to save habitat')
      }

      return h.redirect(
        `${listHref(uploadType, projectId)}${habitatListAnchorFor(payload, featureId)}`
      )
    }
  }
}

function createHabitatDetailsControllers(uploadType) {
  return {
    getController: createGetController(uploadType),
    postController: createPostController(uploadType)
  }
}

export {
  createHabitatDetailsControllers,
  fetchFeature,
  fetchProjectName,
  fetchProject
}
