import { createUnitSummaryPlaceholderController } from '../common/helpers/unit-summary-placeholder-controller.js'
import {
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TEXT
} from '../common/helpers/unit-type-navigation.js'

export const getController = createUnitSummaryPlaceholderController({
  label: WATERCOURSES_TEXT,
  current: WATERCOURSES_TEXT,
  summaryPath: WATERCOURSES_SUMMARY_PATH
})
