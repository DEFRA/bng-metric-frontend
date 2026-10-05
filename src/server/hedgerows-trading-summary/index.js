import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { HEDGEROWS_TRADING_SUMMARY_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const hedgerowsTradingSummary = createProjectGetPlugin({
  name: 'hedgerows-trading-summary',
  path: HEDGEROWS_TRADING_SUMMARY_PATH,
  getController
})
