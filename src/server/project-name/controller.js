import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { backendRequest } from '../common/helpers/auth/backend-request.js'
import { validateProjectName } from '../common/helpers/project-name.js'

const backendUrl = config.get('backend').url

export const defineProjectNameController = {
  handler(_request, h) {
    return h.view('project-name/index', {
      pageTitle: 'Define Project Name',
      heading: 'Add a name for your Biodiversity Net Gain project'
    })
  }
}

export const defineProjectNamePostController = {
  async handler(request, h) {
    const { projectName } = request.payload
    const errors = validateProjectName(projectName)

    if (errors.length > 0) {
      return h.view('project-name/index', {
        pageTitle: 'Error: Define Project Name',
        heading: 'Project Name',
        projectName,
        errors,
        errorMessage: { text: errors[0].text }
      })
    }

    // Identity (userId / org / relationship) is derived by the backend from the
    // verified Bearer token, so the body carries only the project document.
    const { res } = await backendRequest(
      request,
      'post',
      `${backendUrl}/projects/new`,
      {
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({ project: { name: projectName } })
      }
    )

    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to create project')
    }

    return h.redirect('/manage-projects')
  }
}
