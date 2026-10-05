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
  formatSummaryAreaSize
} from '../common/helpers/format-habitat-values.js'

const PAGE_HEADING = 'Post intervention for area habitats'
const RESULTS_HEADING = 'Area habitats results'
const DETAILS_HEADING = 'Area habitat details'
const AREA_SIZE_HEADING = 'Area habitats size'
const BASELINE_AREA_LABEL = 'Total baseline habitat area'
const POST_INTERVENTION_AREA_LABEL = 'Total post intervention habitat area'
const SITE_AREA_LABEL =
  'Site Area (excluding areas of individual trees, green walls, intertidal hard structures)'
const NOT_AVAILABLE = 'N/A'

function collectAreaFeatures(project, phase) {
  const source = project?.[phase]
  return [...(source?.habitats ?? []), ...(source?.trees ?? [])]
}

function areaSizeTile(label, squareMetres) {
  return {
    label,
    value: formatSummaryAreaSize(squareMetres) || NOT_AVAILABLE
  }
}

// "Area habitats" totals are the redline boundary plus individual trees, green
// walls and intertidal hard structures; "site" is the redline boundary only.
function buildAreaSize(project) {
  const baselineSizes = project?.baseline?.habitatSizes
  const postInterventionSizes = project?.postIntervention?.habitatSizes
  if (!postInterventionSizes) {
    return null
  }
  return {
    heading: AREA_SIZE_HEADING,
    tiles: [
      areaSizeTile(
        BASELINE_AREA_LABEL,
        baselineSizes?.areaHabitats?.totalSquareMetres
      ),
      areaSizeTile(
        POST_INTERVENTION_AREA_LABEL,
        postInterventionSizes.areaHabitats?.totalSquareMetres
      ),
      areaSizeTile(
        SITE_AREA_LABEL,
        postInterventionSizes.site?.totalSquareMetres
      )
    ]
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
