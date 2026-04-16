import { initiateUpload } from '../common/services/uploader.js'
import { config } from '../../config/config.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')
const appBaseUrl = config.get('cdpUploader.url')
  ? `http://localhost:${config.get('port')}`
  : ''

async function fetchProjectName(id) {
  try {
    const response = await fetch(`${backendUrl}/projects/${id}`)
    const data = await response.json()
    return data.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

function viewData(projectId, projectName) {
  return {
    pageTitle: 'Upload Baseline File',
    heading: 'Upload a GeoPackage file',
    caption: projectName,
    projectId,
    instructionText:
      'Upload a GIS file containing your red line boundary and baseline habitat parcels.',
    secondaryText:
      'We\u2019ll identify the layers in your file and look up location information automatically.'
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const projectName = await fetchProjectName(id)

    const uploadSession = await initiateUpload({
      redirect: `${appBaseUrl}/projects/${id}/upload-received`,
      s3Bucket: config.get('cdpUploader.bucket'),
      s3Path: config.get('cdpUploader.s3Path'),
      metadata: { projectId: id }
    })

    if (uploadSession.error) {
      return h.view('upload-baseline-file/upload-baseline-file', {
        ...viewData(id, projectName),
        uploadError: uploadSession.error
      })
    }

    request.yar.set('pendingUploadId', uploadSession.uploadId)

    return h.view('upload-baseline-file/upload-baseline-file', {
      ...viewData(id, projectName),
      uploadUrl: uploadSession.uploadUrl
    })
  }
}
