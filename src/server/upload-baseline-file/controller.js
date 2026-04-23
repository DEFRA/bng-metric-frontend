import { initiateUpload } from '../common/services/uploader.js'
import { backendClient } from '../common/services/backend-client.js'
import { config } from '../../config/config.js'

const appBaseUrl = config.get('appBaseUrl')

async function fetchProjectName(request, id) {
  try {
    const { payload } = await backendClient(request).get(`/projects/${id}`, {
      json: true
    })
    return payload?.project?.name ?? 'Project'
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
    const projectName = await fetchProjectName(request, id)
    // Flash message: read once and clear so it doesn't persist on refresh
    const baselineError = request.yar.get('baselineError')

    if (baselineError) {
      request.yar.clear('baselineError')
    }

    const uploadSession = await initiateUpload(request, {
      redirect: `${appBaseUrl}/projects/${id}/upload-received`,
      s3Bucket: config.get('cdpUploader.bucket'),
      s3Path: config.get('cdpUploader.s3Path'),
      metadata: { projectId: id }
    })

    request.yar.set('pendingUploadId', uploadSession.uploadId)

    return h.view('upload-baseline-file/upload-baseline-file', {
      ...viewData(id, projectName),
      uploadUrl: uploadSession.uploadUrl,
      error: baselineError ? { text: baselineError } : undefined
    })
  }
}
