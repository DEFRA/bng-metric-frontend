import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { wreck } from './wreck-client.js'
import { getStrategy } from '../../baseline-habitat-details/strategies/index.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

async function fetchProjectName(projectId) {
  try {
    const { payload } = await wreck.get(`${backendUrl}/projects/${projectId}`)
    return payload?.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

async function fetchFeature(uploadType, projectId, featureId) {
  try {
    const { payload } = await wreck.get(
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
  }
  if (payload?.type === 'watercourse') {
    return '#watercourses'
  }
  return `#habitat-${featureId}`
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
      const [{ type, feature }, projectName] = await Promise.all([
        fetchFeature(uploadType, projectId, featureId),
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
          crumb: Joi.string().optional()
        })
      }
    },
    async handler(request, h) {
      const { projectId, featureId, broadHabitat, habitatType, condition } =
        request.payload

      let payload
      try {
        const result = await wreck.put(
          `${backendUrl}/${uploadType.backendSavePath(projectId, featureId)}`,
          {
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify({
              broadType: broadHabitat || null,
              habitatType: habitatType || null,
              condition: condition || null
            })
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

export { createHabitatDetailsControllers }
