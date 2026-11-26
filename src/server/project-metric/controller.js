import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../common/constants.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import { serviceBusyError } from '../common/helpers/service-busy.js'
import { fetchMetricWorkbook } from '../common/services/metric-workbook.js'

const METRIC_ERROR = 'Failed to generate the metric workbook'

const METRIC_FORMATS = Object.freeze({
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
})

/**
 * Anything outside a conservative set is replaced rather than stripped, so two
 * differently-named projects cannot collapse to the same filename, and the
 * header is ASCII-only by construction. The same rules as the backend's site
 * report filename.
 */
const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9-_ ]/g
const HAS_A_LETTER_OR_DIGIT = /[a-zA-Z0-9]/
const MAX_NAME_LENGTH = 80
const FALLBACK_NAME = 'bng-site'

// en-CA formats a date as YYYY-MM-DD. The date is the user's, so it is
// London's rather than the server's UTC.
const LONDON_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

/**
 * "Riverside Farm" downloaded on 3 November 2026 as xlsm is
 * `Riverside Farm-metric-2026-11-03.xlsm` (BMD-1141 AC7). A name with nothing
 * safe left in it uses the fallback instead (AC8).
 *
 * @param {string|undefined} projectName
 * @param {'xlsm'|'xlsx'} format
 * @param {Date} now
 * @returns {string}
 */
function metricFilename(projectName, format, now) {
  const cleaned = String(projectName ?? '')
    .replaceAll(UNSAFE_FILENAME_CHARS, '-')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
  const name = HAS_A_LETTER_OR_DIGIT.test(cleaned) ? cleaned : FALLBACK_NAME
  return `${name}-metric-${LONDON_DATE.format(now)}.${format}`
}

/**
 * Stream the backend's filled-in metric workbook back to the browser as a
 * download.
 *
 * The project is read first for its name, which the filename needs; the
 * backend's own `content-disposition` is not forwarded, as it would carry a
 * header built from user input through a second service. Reading it first
 * also turns a project with no baseline into "Page not found" (AC11) without
 * asking the backend to build anything.
 *
 * A backend too busy to start building is "Sorry, the service is busy", with
 * its wait. A backend that cannot build the file is a 502 error page, and nothing is
 * sent until all of the bytes have arrived, so no partial file is downloaded
 * (AC13).
 */
const getController = {
  handler: async (request, h) => {
    const { id, format } = request.params

    const project = await fetchProjectOrThrow(request, id)
    if (!hasBaselineData(project)) {
      throw Boom.notFound('Project has no baseline')
    }

    const result = await fetchMetricWorkbook(request, id, format)

    if (result?.statusCode === statusCodes.notFound) {
      throw Boom.notFound('Project not found')
    }
    // Every build slot stayed busy: the user is asked to wait and try
    // again, with the backend's wait, rather than shown an error.
    if (result?.statusCode === statusCodes.serviceUnavailable) {
      throw serviceBusyError(result.headers)
    }
    if (
      !result?.bytes?.length ||
      result.statusCode < statusCodes.ok ||
      result.statusCode >= HTTP_SUCCESS_MAX
    ) {
      throw Boom.badGateway(METRIC_ERROR)
    }

    const filename = metricFilename(project.name, format, new Date())
    return h
      .response(result.bytes)
      .type(METRIC_FORMATS[format])
      .header('content-disposition', `attachment; filename="${filename}"`)
  }
}

export { METRIC_FORMATS, getController, metricFilename }
