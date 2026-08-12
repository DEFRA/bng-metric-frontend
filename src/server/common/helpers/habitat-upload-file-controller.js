import { initiateUpload } from '../services/uploader.js'
import { config } from '../../../config/config.js'
import { backendRequest } from './auth/backend-request.js'
import {
  safeUploadReturnUrl,
  uploadFileHref
} from './upload-file-navigation.js'

const backendUrl = config.get('backend').url
const appBaseUrl = config.get('appBaseUrl')

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
    pageTitle: uploadType.uploadPageTitle,
    heading: 'Upload a GeoPackage (.gpkg) file',
    caption: projectName,
    projectId,
    instructionText: uploadType.uploadInstruction,
    backHref: selectionHref,
    cancelHref: selectionHref
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

      request.yar.set(
        uploadType.pendingUploadSessionKey,
        uploadSession.uploadId
      )

      return h
        .view('habitat-upload-file/habitat-upload-file', {
          ...viewData(id, projectName, uploadType, request.query?.returnUrl),
          uploadUrl: uploadSession.uploadUrl,
          error: uploadError ? { text: uploadError } : undefined
        })
        .header('Cache-Control', 'no-store')
    }
  }
}

export { createUploadFileController }
