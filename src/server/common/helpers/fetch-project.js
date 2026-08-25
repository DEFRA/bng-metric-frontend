import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../constants.js'
import { fetchProject } from '../services/projects.js'

const FETCH_PROJECT_ERROR = 'Failed to fetch project'

/**
 * Fetch a project by id, translating backend/network failures into the
 * Boom errors the route's error handler expects.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} id - Project UUID
 * @returns {Promise<object|null>} the project, or null if not present in the payload
 */
async function fetchProjectOrThrow(request, id) {
  const result = await fetchProject(request, id)

  if (!result) {
    throw Boom.badGateway(FETCH_PROJECT_ERROR)
  }
  if (result.statusCode === statusCodes.notFound) {
    throw Boom.notFound('Project not found')
  }
  if (
    result.statusCode < statusCodes.ok ||
    result.statusCode >= HTTP_SUCCESS_MAX
  ) {
    throw Boom.badGateway(FETCH_PROJECT_ERROR)
  }

  return result.payload?.project
}

export { fetchProjectOrThrow }
