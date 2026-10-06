import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { backendRequest } from '../common/helpers/auth/backend-request.js'

const backendUrl = config.get('backend').url

export const projectsListController = {
  async handler(request, h) {
    const userId = request.auth.credentials.sub
    const { res, payload: projects } = await backendRequest(
      request,
      'get',
      `${backendUrl}/users/${userId}/projects`
    )

    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to fetch projects')
    }

    if (projects.length === 0) {
      return h.redirect('/project-name')
    }

    return h.view('projects/index', {
      pageTitle: 'Projects',
      heading: 'Manage your Biodiversity Net Gain projects',
      projects: projects.map((project) => ({
        ...project,
        href: `/projects/${project.id}/project-summary`
      }))
    })
  }
}
