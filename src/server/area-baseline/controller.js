import {
  AREA_BASELINE_PATH,
  AREA_HABITATS_TEXT
} from '../common/helpers/unit-type-navigation.js'
import {
  areaInterventionSummary,
  areaUnits
} from '../common/helpers/unit-summary.js'
import { formatAreaHectares } from '../common/helpers/format-habitat-values.js'
import { BROAD_HABITAT_COLUMN } from '../common/helpers/baseline-habitat-grid.js'
import { createHabitatBaselineController } from '../common/helpers/create-habitat-baseline-controller.js'

const PAGE_HEADING = 'Baseline for area habitats'
const RESULTS_HEADING = 'Area habitats results'
const DETAILS_HEADING = 'Area habitat details'

function collectAreaFeatures(project) {
  const habitats = project?.baseline?.habitats ?? []
  const trees = project?.baseline?.trees ?? []
  return [...habitats, ...trees]
}

export const getController = createHabitatBaselineController({
  path: AREA_BASELINE_PATH,
  pageHeading: PAGE_HEADING,
  resultsHeading: RESULTS_HEADING,
  detailsHeading: DETAILS_HEADING,
  label: AREA_HABITATS_TEXT,
  collectFeatures: collectAreaFeatures,
  baselineUnits: (project) => areaUnits(project?.baseline?.units),
  buildIntervention: areaInterventionSummary,
  readSize: (feature) => feature.sizeSquareMetres,
  formatSize: formatAreaHectares,
  formatSizeTotal: formatAreaHectares,
  extraColumns: [BROAD_HABITAT_COLUMN]
})
