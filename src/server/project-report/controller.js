import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../common/constants.js'
import { fetchSiteReport } from '../common/services/report.js'

const CONTENT_TYPE_PDF = 'application/pdf'
const REPORT_ERROR = 'Failed to generate the site report'

/**
 * Stream the backend's generated site report back to the browser as a download.
 *
 * The frontend does not render the report — it holds the user's session, and
 * the backend holds the geometry, so this exists to turn one into the other:
 * the session's bearer token goes out with the request, the PDF bytes come
 * back, and the browser is told to save rather than display them.
 *
 * A project the user cannot see, or one with no baseline yet, comes back as a
 * 404 from the backend and is passed through as one. The summary page only
 * offers the link once a baseline exists, so reaching either case means a
 * hand-typed URL.
 */
const getController = {
  handler: async (request, h) => {
    const { id } = request.params

    const result = await fetchSiteReport(request, id)

    if (!result) {
      throw Boom.badGateway(REPORT_ERROR)
    }
    if (result.statusCode === statusCodes.notFound) {
      throw Boom.notFound('Project not found')
    }
    if (
      result.statusCode < statusCodes.ok ||
      result.statusCode >= HTTP_SUCCESS_MAX ||
      !result.pdf
    ) {
      throw Boom.badGateway(REPORT_ERROR)
    }

    return h
      .response(result.pdf)
      .type(CONTENT_TYPE_PDF)
      .header('content-disposition', `attachment; filename="${filename(id)}"`)
  }
}

/**
 * The backend names the file after the site; this one is deliberately dumber.
 *
 * Trusting the backend's `content-disposition` would mean forwarding a header
 * built from a user-supplied project name through a second service. The
 * project id is inert, always safe to interpolate, and the user renames the
 * file anyway.
 */
function filename(projectId) {
  return `bng-site-report-${projectId}.pdf`
}

export { getController, filename }
