import { config } from '../../config/config.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

// TODO: Handle project fetch failure — currently falls back silently to 'Project'.
// Should display an error on the page (e.g. "Project could not be loaded") or
// redirect to an error page if the project doesn't exist or the backend is unavailable.
async function fetchProjectName(id) {
  try {
    const response = await fetch(`${backendUrl}/projects/${id}`)
    // TODO: Check response.ok and handle non-200 responses (e.g. 404, 500)
    const data = await response.json()
    return data.project?.name ?? 'Project'
  } catch {
    // TODO: Distinguish between network errors and missing projects
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

    return h.view(
      'upload-baseline-file/upload-baseline-file',
      viewData(id, projectName)
    )
  }
}

export const postController = {
  async handler(request, h) {
    const { id } = request.params
    const file = request.payload?.file
    const hasFile = file && file.hapi && file.hapi.filename

    if (!hasFile) {
      const projectName = await fetchProjectName(id)

      return h
        .view('upload-baseline-file/upload-baseline-file', {
          ...viewData(id, projectName),
          pageTitle: 'Error: Upload Baseline File',
          error: {
            text: 'Select a GeoPackage (.gpkg) file',
            href: '#file'
          }
        })
        .code(400)
    }

    // File processing deferred to BMD-343
    return h.redirect(`/projects/${id}`)
  }
}
