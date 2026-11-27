import { fetchBackendFile } from './backend-file.js'

/**
 * Fetch a project written into the Statutory Biodiversity Metric, as workbook
 * bytes: `xlsm` is the macro-enabled workbook, `xlsx` the macro-free one.
 *
 * Returns `{ statusCode, bytes, headers }` for any HTTP response, or `null`
 * when the backend could not be reached at all (see `fetchBackendFile`). The
 * headers carry the backend's `Retry-After` when it is too busy to build.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} projectId
 * @param {'xlsm'|'xlsx'} format
 * @returns {Promise<{statusCode: number, bytes: Buffer|null, headers: object}|null>}
 */
function fetchMetricWorkbook(request, projectId, format) {
  return fetchBackendFile(request, {
    projectId,
    path: `/projects/${projectId}/metric.${format}`,
    what: `metric workbook (${format})`
  })
}

export { fetchMetricWorkbook }
