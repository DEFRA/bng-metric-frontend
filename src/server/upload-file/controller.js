import Boom from '@hapi/boom'
import Joi from 'joi'

import { statusCodes, HTTP_SUCCESS_MAX } from '../common/constants.js'
import {
  safeUploadReturnUrl,
  selectedUploadHref
} from '../common/helpers/upload-file-navigation.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { fetchProject } from '../common/services/projects.js'

const FILE_TYPES = {
  baseline: {
    value: HABITAT_UPLOAD_TYPES.baseline.key,
    text: 'Baseline Biodiversity Net Gain GeoPackage (.gpkg) file',
    uploadRoute: HABITAT_UPLOAD_TYPES.baseline.uploadRoute
  },
  postIntervention: {
    value: HABITAT_UPLOAD_TYPES.postIntervention.key,
    text: 'Post-intervention Biodiversity Net Gain GeoPackage (.gpkg) file',
    uploadRoute: HABITAT_UPLOAD_TYPES.postIntervention.uploadRoute
  }
}

const SELECT_FILE_TYPE_ERROR = 'Select the type of file you want to upload'
const BASELINE_REQUIRED_ERROR =
  'Upload a baseline file before uploading a post intervention file'

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
  return h.view('upload-file/index', {
    pageTitle: error
      ? 'Error: What would you like to upload?'
      : 'What would you like to upload?',
    heading: 'What would you like to upload?',
    caption: project?.name ?? 'Project',
    projectId,
    returnUrl: safeReturnUrl,
    backHref: safeReturnUrl,
    cancelHref: safeReturnUrl,
    items: radioItems(selectedUploadType),
    error
  })
}

function selectedTypeError(uploadType, project) {
  if (!uploadType) {
    return SELECT_FILE_TYPE_ERROR
  }
  if (uploadType === FILE_TYPES.postIntervention.value && !project?.baseline) {
    return BASELINE_REQUIRED_ERROR
  }
  return null
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
    const error = selectedTypeError(uploadType, project)

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

export {
  BASELINE_REQUIRED_ERROR,
  FILE_TYPES,
  SELECT_FILE_TYPE_ERROR,
  payloadSchema
}
