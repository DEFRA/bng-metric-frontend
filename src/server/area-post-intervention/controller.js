import {
  AREA_BASELINE_PATH,
  AREA_HABITATS_TEXT,
  AREA_POST_INTERVENTION_PATH,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import {
  areaBaselineAction,
  areaInterventionSummary,
  areaUnits
} from '../common/helpers/unit-summary.js'
import { createHabitatPostInterventionController } from '../common/helpers/create-habitat-post-intervention-controller.js'
import { buildAreaLeadingExtraColumns } from '../common/helpers/area-post-intervention-grid.js'
import {
  formatAreaHectares,
  formatTotalAreaSize
} from '../common/helpers/format-habitat-values.js'

const PAGE_HEADING = 'Post intervention for area habitats'
const RESULTS_HEADING = 'Area habitats results'
const DETAILS_HEADING = 'Area habitat details'

function collectAreaFeatures(project, phase) {
  const source = project?.[phase]
  return [...(source?.habitats ?? []), ...(source?.trees ?? [])]
}

function buildAreaSize(project) {
  const habitatSizes = project?.postIntervention?.habitatSizes
  if (!habitatSizes) {
    return null
  }
  return {
    site: formatTotalAreaSize(habitatSizes.site?.totalSquareMetres),
    areaHabitats: formatTotalAreaSize(
      habitatSizes.areaHabitats?.totalSquareMetres
    )
  }
}

export const getController = createHabitatPostInterventionController({
  path: AREA_POST_INTERVENTION_PATH,
  pageHeading: PAGE_HEADING,
  resultsHeading: RESULTS_HEADING,
  detailsHeading: DETAILS_HEADING,
  label: AREA_HABITATS_TEXT,
  habitatNoun: 'area',
  collectFeatures: collectAreaFeatures,
  readSize: (feature) => feature.sizeSquareMetres,
  formatSize: formatAreaHectares,
  formatSizeTotal: formatAreaHectares,
  buildLeadingExtraColumns: buildAreaLeadingExtraColumns,
  buildAreaSize,
  baselineUnits: (project) => areaUnits(project?.baseline?.units),
  buildIntervention: areaInterventionSummary,
  baselineAction: (projectId) =>
    areaBaselineAction(projectPageHref(projectId, AREA_BASELINE_PATH))
})
