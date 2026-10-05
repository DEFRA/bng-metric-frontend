import {
  HEDGEROWS_HABITAT_KEY,
  HEDGEROWS_SUMMARY_PATH,
  HEDGEROWS_TRADING_SUMMARY_PATH
} from '../common/helpers/unit-type-navigation.js'
import { createTradingSummaryController } from '../common/helpers/trading-summary.js'

export const getController = createTradingSummaryController({
  view: 'hedgerows-trading-summary/index',
  summaryPath: HEDGEROWS_SUMMARY_PATH,
  pagePath: HEDGEROWS_TRADING_SUMMARY_PATH,
  pageHeading: 'Hedgerows trading rules',
  habitatKey: HEDGEROWS_HABITAT_KEY,
  buildTrading: () => null
})
