import Boom from '@hapi/boom'

import { config } from '../../config/config.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

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

export const defineProjectNameController = {
  handler(_request, h) {
    return h.view('define-project-name/index', {
      pageTitle: 'Define Project Name',
      heading: 'Project Name'
    })
  }
}

export const defineProjectNamePostController = {
  async handler(request, h) {
    const { projectName } = request.payload
    const errors = validateProjectName(projectName)

    if (errors.length > 0) {
      return h.view('define-project-name/index', {
        pageTitle: 'Error: Define Project Name',
        heading: 'Project Name',
        projectName,
        errors,
        errorMessage: { text: errors[0].text }
      })
    }

    const response = await fetch(`${backendUrl}/projects/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: { name: projectName },
        userId: request.auth.credentials.sub
      })
    })

    if (!response.ok) {
      throw Boom.badGateway('Failed to create project')
    }

    return h.redirect('/project-dashboard')
  }
}
