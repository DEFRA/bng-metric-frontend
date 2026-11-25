import { fetchBackendFile } from './backend-file.js'

/**
 * Fetch a project's site report from the backend, as PDF bytes.
 *
 * Returns `{ statusCode, pdf }` for any HTTP response, or `null` when the
 * backend could not be reached at all (see `fetchBackendFile`).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} projectId
 * @returns {Promise<{statusCode: number, pdf: Buffer|null}|null>}
 */
async function fetchSiteReport(request, projectId) {
  const result = await fetchBackendFile(request, {
    projectId,
    path: `/projects/${projectId}/report.pdf`,
    what: 'site report'
  })
  return result && { statusCode: result.statusCode, pdf: result.bytes }
}

export { fetchSiteReport }
