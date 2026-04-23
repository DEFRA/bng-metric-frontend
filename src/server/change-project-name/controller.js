import Joi from 'joi'
import Boom from '@hapi/boom'

import { config } from '../../config/config.js'

const backendUrl = config.get('backend').url
const BACKEND_TIMEOUT_MS = 5000

function hasInvalidChars(str) {
  return [...str].some((char) => {
    const codePoint = char.codePointAt(0)
    return (
      codePoint < 0x20 ||
      codePoint === 0x7f ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    )
  })
}

function validateProjectName(projectName) {
  const errors = []

  if (!projectName || projectName.trim() === '') {
    errors.push({
      text: 'Enter a project name',
      href: '#project-name'
    })
  } else if (projectName.length > 1000) {
    errors.push({
      text: 'Project name must be 1000 characters or fewer',
      href: '#project-name'
    })
  } else if (hasInvalidChars(projectName)) {
    errors.push({
      text: 'Project name must only contain valid characters',
      href: '#project-name'
    })
  }

  return errors
}

export const changeProjectNameController = {
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

    if (data?.statusCode === 404) {
      throw Boom.notFound('Project not found')
    }

    return h.view('change-project-name/index', {
      pageTitle: 'Change Project Name',
      heading: 'Change Project Name',
      projectId: id,
      projectName: data?.project?.name
    })
  }
}

export const changeProjectNamePostController = {
  options: {
    validate: {
      params: Joi.object({
        id: Joi.string().uuid().required()
      })
    }
  },
  async handler(request, h) {
    const { id } = request.params
    const { projectName } = request.payload
    const errors = validateProjectName(projectName)

    if (errors.length > 0) {
      return h.view('change-project-name/index', {
        pageTitle: 'Error: Change Project Name',
        heading: 'Change Project Name',
        projectId: id,
        projectName,
        errors,
        errorMessage: { text: errors[0].text }
      })
    }

    const response = await fetch(`${backendUrl}/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: { name: projectName } })
    })

    if (!response.ok) {
      throw Boom.badGateway('Failed to update project name')
    }

    return h.redirect(`/project-task-list/${id}`)
  }
}
