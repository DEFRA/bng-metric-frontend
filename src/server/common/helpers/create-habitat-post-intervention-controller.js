import { uploadFileHref } from './upload-file-navigation.js'
import {
  hasBaselineData,
  hasPostInterventionOnlyHabitat
} from './project-state.js'
import {
  buildUnitTypeNavigation,
  projectPageHref
} from './unit-type-navigation.js'
import { fetchProjectOrThrow } from './fetch-project.js'
import { buildUnitSummary } from './unit-summary.js'
import {
  featureMatchesCategory,
  visibleInterventionTabs
} from './intervention-tabs.js'
import { sortHabitatFeatures } from './habitat-grid.js'
import {
  buildPostInterventionHabitatGrid,
  habitatTabHeading
} from './post-intervention-habitat-grid.js'
import { DEFAULT_PROJECT_NAME } from '../constants.js'

const INTERVENTION_TABS_TITLE = 'Intervention type'

function buildTabPanel(tab, features, projectId, config) {
  const heading = habitatTabHeading(tab.label, config.habitatNoun)
  const tabFeatures = sortHabitatFeatures(
    features.filter((feature) => featureMatchesCategory(feature, tab.label))
  )

  return {
    id: tab.id,
    label: tab.label,
    heading,
    detailsRegionLabel: heading,
    ...buildPostInterventionHabitatGrid({
      features: tabFeatures,
      projectId,
      interventionType: tab.label,
      readSize: config.readSize,
      formatSize: config.formatSize,
      formatSizeTotal: config.formatSizeTotal
    })
  }
}

function tabById(panels, id) {
  return panels.find((panel) => panel.id === id) ?? null
}

function buildHabitatPostIntervention(project, projectId, config) {
  const pageHref = projectPageHref(projectId, config.path)
  const uploadHref = uploadFileHref(projectId, pageHref)
  const postInterventionOnly = hasPostInterventionOnlyHabitat(
    project,
    config.habitatKey
  )
  const intervention = project?.postIntervention
    ? config.buildIntervention(project.postIntervention.units)
    : null
  const features = project?.postIntervention?.[config.habitatKey] ?? []
  const interventionTabPanels = visibleInterventionTabs(features).map((tab) =>
    buildTabPanel(tab, features, projectId, config)
  )

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    heading: config.pageHeading,
    resultsHeading: config.resultsHeading,
    detailsHeading: config.detailsHeading,
    interventionTabsTitle: INTERVENTION_TABS_TITLE,
    uploadHref,
    navigationItems: buildUnitTypeNavigation(project, projectId, pageHref),
    unitSummary: buildUnitSummary({
      label: config.label,
      baselineUnits: config.baselineUnits(project),
      uploadHref,
      intervention,
      postInterventionOnly,
      baselineAction: config.baselineAction(projectId),
      interventionAction: null
    }),
    retainedTab: tabById(interventionTabPanels, 'retained'),
    enhancedTab: tabById(interventionTabPanels, 'enhanced'),
    createdTab: tabById(interventionTabPanels, 'created')
  }
}

function createHabitatPostInterventionController(config) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const project = await fetchProjectOrThrow(request, id)

      if (hasBaselineData(project)) {
        const viewModel = buildHabitatPostIntervention(project, id, config)

        return h.view('common/templates/habitat-post-intervention-page', {
          pageTitle: config.pageHeading,
          ...viewModel
        })
      }

      return h.redirect(`/add-project-details/${id}`)
    }
  }
}

export { buildHabitatPostIntervention, createHabitatPostInterventionController }
