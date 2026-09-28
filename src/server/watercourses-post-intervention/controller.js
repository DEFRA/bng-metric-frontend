import {
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_HABITAT_KEY,
  WATERCOURSES_POST_INTERVENTION_PATH,
  WATERCOURSES_TEXT,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import {
  watercoursesBaselineAction,
  watercoursesInterventionSummary
} from '../common/helpers/unit-summary.js'
import { createHabitatPostInterventionController } from '../common/helpers/create-habitat-post-intervention-controller.js'
import { WATERCOURSES_TOTAL_KEY } from '../common/constants.js'
import {
  formatLengthKmDisplay,
  formatTotalLengthSize
} from '../common/helpers/format-habitat-values.js'
import { buildWatercourseExtraColumns } from '../common/helpers/watercourse-post-intervention-grid.js'
import { watercourseTradingRulesStatus } from '../common/helpers/trading-rules-status.js'

const PAGE_HEADING = 'Post intervention for watercourses'
const RESULTS_HEADING = 'Watercourses results'
const DETAILS_HEADING = 'Watercourses habitat details'

export const getController = createHabitatPostInterventionController({
  path: WATERCOURSES_POST_INTERVENTION_PATH,
  pageHeading: PAGE_HEADING,
  resultsHeading: RESULTS_HEADING,
  detailsHeading: DETAILS_HEADING,
  label: WATERCOURSES_TEXT,
  habitatNoun: 'watercourse',
  habitatKey: WATERCOURSES_HABITAT_KEY,
  readSize: (feature) => feature.sizeMetres,
  formatSize: formatLengthKmDisplay,
  formatSizeTotal: formatTotalLengthSize,
  buildExtraColumns: buildWatercourseExtraColumns,
  baselineUnits: (project) =>
    project?.baseline?.units?.[WATERCOURSES_TOTAL_KEY],
  buildIntervention: watercoursesInterventionSummary,
  baselineAction: (projectId) =>
    watercoursesBaselineAction(
      projectPageHref(projectId, WATERCOURSES_BASELINE_PATH)
    ),
  tradingRulesStatus: watercourseTradingRulesStatus
})
