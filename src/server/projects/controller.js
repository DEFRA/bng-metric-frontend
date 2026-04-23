import Joi from 'joi'
import Boom from '@hapi/boom'
import { config } from '../../config/config.js'

const backendUrl = config.get('backend').url
const BACKEND_TIMEOUT_MS = 5000

export const projectsListController = {
  async handler(request, h) {
    const userId = request.auth.credentials.sub
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), BACKEND_TIMEOUT_MS)

    let response
    try {
      response = await fetch(`${backendUrl}/users/${userId}/projects`, {
        signal: abort.signal
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        throw Boom.gatewayTimeout('Backend request timed out')
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw Boom.badGateway('Failed to fetch projects')
    }

    const projects = await response.json()

    return h.view('projects/index', {
      pageTitle: 'Projects',
      heading: 'Projects',
      projects
    })
  }
}

export const projectTaskListController = {
  options: {
    validate: {
      params: Joi.object({
        id: Joi.string().uuid().required()
      })
    }
  },
  async handler(request, h) {
    const { id } = request.params
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), BACKEND_TIMEOUT_MS)

    let response

    try {
      response = await fetch(`${backendUrl}/projects/${id}`, {
        signal: abort.signal
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        throw Boom.gatewayTimeout('Backend request timed out')
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    const data = await response.json()

    return h.view('projects/task-list', {
      pageTitle: 'Project Task List',
      heading: data?.project?.name ?? 'Project not found',
      data,
      error: data?.statusCode === 404
    })
  }
}
