import { createProjectGetPlugin } from '../common/helpers/create-project-get-plugin.js'
import { WATERCOURSES_TRADING_SUMMARY_PATH } from '../common/helpers/unit-type-navigation.js'
import { getController } from './controller.js'

export const watercoursesTradingSummary = createProjectGetPlugin({
  name: 'watercourses-trading-summary',
  path: WATERCOURSES_TRADING_SUMMARY_PATH,
  getController
})
