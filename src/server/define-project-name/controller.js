import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { validateProjectName } from '../common/helpers/project-name.js'

const backendUrl = config.get('backend').url
const BACKEND_TIMEOUT_MS = 5000

export const defineProjectNameController = {
  handler(_request, h) {
    return h.view('define-project-name/index', {
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
      return h.view('define-project-name/index', {
        pageTitle: 'Error: Define Project Name',
        heading: 'Project Name',
        projectName,
        errors,
        errorMessage: { text: errors[0].text }
      })
    }

    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), BACKEND_TIMEOUT_MS)

    let response

    try {
      response = await fetch(`${backendUrl}/projects/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: { name: projectName },
          userId: request.auth.credentials.sub
        }),
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
      throw Boom.badGateway('Failed to create project')
    }

    return h.redirect('/project-dashboard')
  }
}
