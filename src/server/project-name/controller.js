import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
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

    const { res } = await wreck.post(`${backendUrl}/projects/new`, {
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        project: { name: projectName },
        userId: request.auth.credentials.sub
      })
    })

    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to create project')
    }

    return h.redirect('/manage-projects')
  }
}
