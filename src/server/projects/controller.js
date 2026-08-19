import Joi from 'joi'
import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { backendRequest } from '../common/helpers/auth/backend-request.js'
import { hasBaselineData } from '../common/helpers/project-state.js'

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
        // BMD-933: the list endpoint no longer returns the project document, so
        // whether a baseline exists arrives as a flag. The fallback covers the
        // window where this deploys ahead of the backend that sets it.
        href:
          (project.has_baseline ?? hasBaselineData(project.project))
            ? `/projects/${project.id}/project-summary`
            : `/add-project-details/${project.id}`
      }))
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
    try {
      const { payload: data } = await backendRequest(
        request,
        'get',
        `${backendUrl}/projects/${id}`
      )
      const isBaselineUploaded = Boolean(data?.project?.baseline)
      const isPostInterventionUploaded = Boolean(
        data?.project?.postIntervention
      )
      return h.view('projects/task-list', {
        pageTitle: 'Project Task List',
        heading: 'Add your Biodiversity Net Gain project details',
        caption: data?.project?.name ?? 'Project not found',
        data,
        id,
        isBaselineUploaded,
        isPostInterventionUploaded,
        error: false
      })
    } catch (err) {
      if (
        err.isBoom &&
        err.data?.isResponseError &&
        err.output.statusCode === statusCodes.notFound
      ) {
        return h.view('projects/task-list', {
          pageTitle: 'Project Task List',
          heading: 'Add your Biodiversity Net Gain project details',
          caption: 'Project not found',
          data: null,
          id,
          error: true
        })
      }
      throw err
    }
  }
}
