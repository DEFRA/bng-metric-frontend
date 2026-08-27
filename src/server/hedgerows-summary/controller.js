import { createUnitSummaryPlaceholderController } from '../common/helpers/unit-summary-placeholder-controller.js'
import {
  HEDGEROWS_SUMMARY_PATH,
  HEDGEROWS_TEXT
} from '../common/helpers/unit-type-navigation.js'

export const getController = createUnitSummaryPlaceholderController({
  label: HEDGEROWS_TEXT,
  current: HEDGEROWS_TEXT,
  summaryPath: HEDGEROWS_SUMMARY_PATH
})
