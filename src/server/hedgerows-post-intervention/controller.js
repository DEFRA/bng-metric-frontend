import {
  HEDGEROWS_BASELINE_PATH,
  HEDGEROWS_HABITAT_KEY,
  HEDGEROWS_POST_INTERVENTION_PATH,
  HEDGEROWS_TEXT,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import {
  hedgerowsBaselineAction,
  hedgerowsInterventionSummary
} from '../common/helpers/unit-summary.js'
import { createHabitatPostInterventionController } from '../common/helpers/create-habitat-post-intervention-controller.js'
import { HEDGEROWS_TOTAL_KEY } from '../common/constants.js'
import {
  formatLengthKmDisplay,
  formatTotalLengthSize
} from '../common/helpers/format-habitat-values.js'

const PAGE_HEADING = 'Post intervention for hedgerows'
const RESULTS_HEADING = 'Hedgerows results'
const DETAILS_HEADING = 'Hedgerow habitat details'

export const getController = createHabitatPostInterventionController({
  path: HEDGEROWS_POST_INTERVENTION_PATH,
  pageHeading: PAGE_HEADING,
  resultsHeading: RESULTS_HEADING,
  detailsHeading: DETAILS_HEADING,
  label: HEDGEROWS_TEXT,
  habitatNoun: 'hedgerow',
  habitatKey: HEDGEROWS_HABITAT_KEY,
  readSize: (feature) => feature.sizeMetres,
  formatSize: formatLengthKmDisplay,
  formatSizeTotal: formatTotalLengthSize,
  baselineUnits: (project) => project?.baseline?.units?.[HEDGEROWS_TOTAL_KEY],
  buildIntervention: hedgerowsInterventionSummary,
  baselineAction: (projectId) =>
    hedgerowsBaselineAction(projectPageHref(projectId, HEDGEROWS_BASELINE_PATH))
})
