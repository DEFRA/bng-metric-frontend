import { uploadFileHref } from './upload-file-navigation.js'
import { hasBaselineData } from './project-state.js'
import {
  buildUnitTypeNavigation,
  projectPageHref
} from './unit-type-navigation.js'
import { fetchProjectOrThrow } from './fetch-project.js'
import { buildUnitSummary } from './unit-summary.js'
import {
  buildBaselineHabitatGrid,
  sortBaselineFeatures
} from './baseline-habitat-grid.js'
import { DEFAULT_PROJECT_NAME } from '../constants.js'

function buildHabitatBaseline(project, projectId, config) {
  const returnUrl = projectPageHref(projectId, config.path)
  const uploadHref = uploadFileHref(projectId, returnUrl)
  const features = sortBaselineFeatures(config.collectFeatures(project))
  const intervention = project?.postIntervention
    ? config.buildIntervention(project.postIntervention.units)
    : null

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    heading: config.pageHeading,
    resultsHeading: config.resultsHeading,
    detailsHeading: config.detailsHeading,
    detailsRegionLabel: config.detailsHeading,
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      projectPageHref(projectId, config.path)
    ),
    unitSummary: buildUnitSummary({
      label: config.label,
      baselineUnits: config.baselineUnits(project),
      uploadHref,
      intervention,
      baselineAction: config.baselineAction()
    }),
    ...buildBaselineHabitatGrid({
      features,
      projectId,
      readSize: config.readSize,
      formatSize: config.formatSize,
      formatSizeTotal: config.formatSizeTotal,
      extraColumns: config.extraColumns
    })
  }
}

function createHabitatBaselineController(config) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const project = await fetchProjectOrThrow(request, id)

      if (hasBaselineData(project)) {
        const viewModel = buildHabitatBaseline(project, id, config)

        return h.view('common/templates/habitat-baseline-page', {
          pageTitle: config.pageHeading,
          ...viewModel
        })
      }

      return h.redirect(`/add-project-details/${id}`)
    }
  }
}

export { buildHabitatBaseline, createHabitatBaselineController }
