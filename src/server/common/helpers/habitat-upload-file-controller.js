import { initiateUpload } from '../services/uploader.js'
import { config } from '../../../config/config.js'
import { backendRequest } from './auth/backend-request.js'
import {
  safeUploadReturnUrl,
  uploadFileHref
} from './upload-file-navigation.js'
import { formErrorText } from '../error-text/error-text.js'
import {
  CLIENT_FILE_ERROR_TEXT,
  uploadErrorText
} from './file-validation-messages.js'

const backendUrl = config.get('backend').url
const appBaseUrl = config.get('appBaseUrl')

// Shown in place of the form when the uploader gave no address to post to.
const UPLOAD_UNAVAILABLE = formErrorText('file', 'cannotStart').inline

async function fetchProjectName(request, id) {
  try {
    const { payload: data } = await backendRequest(
      request,
      'get',
      `${backendUrl}/projects/${id}`
    )
    return data.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

function viewData(projectId, projectName, uploadType, returnUrl) {
  const safeReturnUrl = safeUploadReturnUrl(returnUrl, projectId)
  const selectionHref = uploadFileHref(projectId, safeReturnUrl)
  return {
    heading: 'Upload a GeoPackage (.gpkg) file',
    caption: projectName,
    projectId,
    instructionText: uploadType.uploadInstruction,
    backHref: selectionHref,
    cancelHref: selectionHref,
    uploadUnavailableText: UPLOAD_UNAVAILABLE,
    fileErrorText: CLIENT_FILE_ERROR_TEXT
  }
}

function createUploadFileController(uploadType) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const projectName = await fetchProjectName(request, id)
      const uploadError = request.yar.get(uploadType.uploadErrorSessionKey)

      if (uploadError) {
        request.yar.clear(uploadType.uploadErrorSessionKey)
      }

      const uploadSession = await initiateUpload(request, {
        redirect: `${appBaseUrl}/projects/${id}/${uploadType.uploadReceivedRoute}`,
        s3Bucket: config.get('cdpUploader.bucket'),
        s3Path: config.get('cdpUploader.s3Path'),
        metadata: { projectId: id, uploadType: uploadType.key }
      })

      // A retry must start its own timeout window. The previous attempt may
      // have left a timestamp behind after redirecting back with an error.
      request.yar.clear(uploadType.uploadStartedAtSessionKey)
      request.yar.set(
        uploadType.pendingUploadSessionKey,
        uploadSession.uploadId
      )

      return h
        .view('common/templates/upload-geopackage-file', {
          ...viewData(id, projectName, uploadType, request.query?.returnUrl),
          pageTitle: uploadError
            ? `Error: ${uploadType.uploadPageTitle}`
            : uploadType.uploadPageTitle,
          uploadUrl: uploadSession.uploadUrl,
          error: uploadError
            ? { text: uploadErrorText(uploadError) }
            : undefined
        })
        .header('Cache-Control', 'no-store')
    }
  }
}

export { createUploadFileController }
