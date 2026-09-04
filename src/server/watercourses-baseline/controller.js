import {
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_HABITAT_KEY,
  WATERCOURSES_TEXT
} from '../common/helpers/unit-type-navigation.js'
import { watercoursesInterventionSummary } from '../common/helpers/unit-summary.js'
import { createLinearHabitatBaselineController } from '../common/helpers/create-linear-habitat-baseline-controller.js'
import { WATERCOURSES_TOTAL_KEY } from '../common/constants.js'

const PAGE_HEADING = 'Baseline for watercourses'
const RESULTS_HEADING = 'Watercourses results'
const DETAILS_HEADING = 'Watercourses details'

export const getController = createLinearHabitatBaselineController({
  path: WATERCOURSES_BASELINE_PATH,
  pageHeading: PAGE_HEADING,
  resultsHeading: RESULTS_HEADING,
  detailsHeading: DETAILS_HEADING,
  label: WATERCOURSES_TEXT,
  habitatKey: WATERCOURSES_HABITAT_KEY,
  unitsKey: WATERCOURSES_TOTAL_KEY,
  buildIntervention: watercoursesInterventionSummary
})
