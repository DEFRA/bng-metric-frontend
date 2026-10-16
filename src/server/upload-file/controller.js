import Boom from '@hapi/boom'
import Joi from 'joi'

import { statusCodes, HTTP_SUCCESS_MAX } from '../common/constants.js'
import {
  safeUploadReturnUrl,
  selectedUploadHref
} from '../common/helpers/upload-file-navigation.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import { fetchProject } from '../common/services/projects.js'

const PROJECTS_PATH = '/manage-projects'

const FILE_TYPES = {
  baseline: {
    value: HABITAT_UPLOAD_TYPES.baseline.key,
    text: 'Baseline',
    uploadRoute: HABITAT_UPLOAD_TYPES.baseline.uploadRoute
  },
  postIntervention: {
    value: HABITAT_UPLOAD_TYPES.postIntervention.key,
    text: 'Post-intervention',
    uploadRoute: HABITAT_UPLOAD_TYPES.postIntervention.uploadRoute
  }
}

const SELECT_FILE_TYPE_ERROR = 'Select the type of file you want to upload'

const payloadSchema = Joi.object({
  uploadType: Joi.string()
    .allow('')
    .valid(...Object.values(FILE_TYPES).map(({ value }) => value))
    .optional(),
  returnUrl: Joi.string().allow('').optional()
})

function radioItems(selectedUploadType) {
  return Object.values(FILE_TYPES).map(({ value, text }) => ({
    value,
    text,
    checked: value === selectedUploadType
  }))
}

async function projectForUpload(request, projectId) {
  const result = await fetchProject(request, projectId)

  if (!result) {
    throw Boom.badGateway('Failed to fetch project')
  }
  if (result.statusCode === statusCodes.notFound) {
    throw Boom.notFound('Project not found')
  }
  if (
    result.statusCode < statusCodes.ok ||
    result.statusCode >= HTTP_SUCCESS_MAX
  ) {
    throw Boom.badGateway('Failed to fetch project')
  }

  return result.payload?.project
}

function renderUploadFilePage(
  h,
  { projectId, project, returnUrl, selectedUploadType, error }
) {
  const safeReturnUrl = safeUploadReturnUrl(returnUrl, projectId)
  // An empty project has no summary to return to, so Back and Cancel go to
  // the project list. The return URL still points at the summary, which is
  // where the user lands once an upload has given the project some data.
  const exitHref = hasBaselineData(project) ? safeReturnUrl : PROJECTS_PATH
  return h.view('upload-file/index', {
    pageTitle: error
      ? 'Error: What would you like to upload?'
      : 'What would you like to upload?',
    heading: 'What would you like to upload?',
    caption: project?.name ?? 'Project',
    projectId,
    returnUrl: safeReturnUrl,
    backHref: exitHref,
    cancelHref: exitHref,
    items: radioItems(selectedUploadType),
    error
  })
}

function selectedTypeError(uploadType) {
  return uploadType ? null : SELECT_FILE_TYPE_ERROR
}

export const getController = {
  async handler(request, h) {
    const { id: projectId } = request.params
    const project = await projectForUpload(request, projectId)

    return renderUploadFilePage(h, {
      projectId,
      project,
      returnUrl: request.query.returnUrl
    })
  }
}

export const postController = {
  options: {
    validate: {
      payload: payloadSchema
    }
  },
  async handler(request, h) {
    const { id: projectId } = request.params
    const { uploadType, returnUrl } = request.payload
    const project = await projectForUpload(request, projectId)
    const error = selectedTypeError(uploadType)

    if (error) {
      return renderUploadFilePage(h, {
        projectId,
        project,
        returnUrl,
        selectedUploadType: uploadType,
        error
      })
    }

    return h.redirect(
      selectedUploadHref(
        projectId,
        FILE_TYPES[uploadType].uploadRoute,
        returnUrl
      )
    )
  }
}

export { FILE_TYPES, SELECT_FILE_TYPE_ERROR, payloadSchema }
