import { initiateUpload } from '../common/services/uploader.js'
import { config } from '../../config/config.js'
import { wreck } from '../common/helpers/wreck-client.js'

const backendUrl = config.get('backend').url
const appBaseUrl = config.get('appBaseUrl')

async function fetchProjectName(id) {
  try {
    const { payload: data } = await wreck.get(`${backendUrl}/projects/${id}`)
    return data.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

function viewData(projectId, projectName) {
  return {
    pageTitle: 'Upload Baseline File',
    heading: 'Upload a GeoPackage (.gpkg) file',
    caption: projectName,
    projectId,
    instructionText:
      'Upload a GeoPackage (.gpkg) file containing a red line boundary and baseline habitat parcels.'
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const projectName = await fetchProjectName(id)
    // Flash message: read once and clear so it doesn't persist on refresh
    const uploadError = request.yar.get('uploadError')

    if (uploadError) {
      request.yar.clear('uploadError')
    }

    const uploadSession = await initiateUpload({
      redirect: `${appBaseUrl}/projects/${id}/upload-received`,
      s3Bucket: config.get('cdpUploader.bucket'),
      s3Path: config.get('cdpUploader.s3Path'),
      metadata: { projectId: id }
    })

    request.yar.set('pendingUploadId', uploadSession.uploadId)

    // Prevent caching — the CDP upload URL embedded in the form action
    // is unique and short-lived, therefore must be fresh on every page load.
    return h
      .view('upload-baseline-file/upload-baseline-file', {
        ...viewData(id, projectName),
        uploadUrl: uploadSession.uploadUrl,
        error: uploadError ? { text: uploadError } : undefined
      })
      .header('Cache-Control', 'no-store')
  }
}
