import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { validateProjectName } from '../common/helpers/project-name.js'

const backendUrl = config.get('backend').url

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
