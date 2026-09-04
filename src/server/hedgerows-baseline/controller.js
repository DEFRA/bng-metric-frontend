import {
  HEDGEROWS_BASELINE_PATH,
  HEDGEROWS_HABITAT_KEY,
  HEDGEROWS_TEXT
} from '../common/helpers/unit-type-navigation.js'
import { hedgerowsInterventionSummary } from '../common/helpers/unit-summary.js'
import { createLinearHabitatBaselineController } from '../common/helpers/create-linear-habitat-baseline-controller.js'
import { HEDGEROWS_TOTAL_KEY } from '../common/constants.js'

const PAGE_HEADING = 'Baseline for hedgerows'
const RESULTS_HEADING = 'Hedgerows results'
const DETAILS_HEADING = 'Hedgerows details'

export const getController = createLinearHabitatBaselineController({
  path: HEDGEROWS_BASELINE_PATH,
  pageHeading: PAGE_HEADING,
  resultsHeading: RESULTS_HEADING,
  detailsHeading: DETAILS_HEADING,
  label: HEDGEROWS_TEXT,
  habitatKey: HEDGEROWS_HABITAT_KEY,
  unitsKey: HEDGEROWS_TOTAL_KEY,
  buildIntervention: hedgerowsInterventionSummary
})
