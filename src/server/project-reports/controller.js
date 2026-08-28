import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import {
  REPORTS_PATH,
  REPORTS_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

/**
 * The Reports page: everything a project can produce as a document, which
 * today is the site report PDF.
 *
 * A page rather than a link buried on the summary so it has room to say what
 * the report contains before the user commits to a download, and so future
 * reports have somewhere to live. The download itself stays on the existing
 * `/projects/{id}/report.pdf` route — this page only points at it.
 */
const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProjectOrThrow(request, id)

    // No baseline means nothing to report on — same rule as the summary page,
    // and the same destination: the journey that gets the project a baseline.
    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }

    return h.view('project-reports/index', {
      pageTitle: REPORTS_TEXT,
      heading: REPORTS_TEXT,
      projectName: project?.name ?? DEFAULT_PROJECT_NAME,
      siteReportHref: `/projects/${id}/report.pdf`,
      navigationItems: buildUnitTypeNavigation(
        project,
        id,
        projectPageHref(id, REPORTS_PATH)
      )
    })
  }
}

export { getController }
