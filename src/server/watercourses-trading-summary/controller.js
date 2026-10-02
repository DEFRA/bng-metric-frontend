import {
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TRADING_SUMMARY_PATH
} from '../common/helpers/unit-type-navigation.js'
import {
  buildDistinctivenessSections,
  buildUnitChangeGrid,
  createTradingSummaryController,
  unitChangeCell
} from '../common/helpers/trading-summary.js'

const PAGE_HEADING = 'Watercourses trading summary'
const MEDIUM_DEFICIT_LABEL = 'Remaining losses; like for like not satisfied'
const UNIT_CHANGE_COLUMNS = ['Habitat type', 'Unit change']

function habitatRow(habitat) {
  return [{ text: habitat.habitatType }, unitChangeCell(habitat.netUnitChange)]
}

function buildTradingSections(project) {
  const figures = project?.postIntervention?.tradingRules?.watercourses
  const habitats = figures?.habitats ?? []

  return buildDistinctivenessSections({
    figures,
    statuses: project?.tradingRuleStatuses?.watercourses,
    habitats,
    deficitLabel: MEDIUM_DEFICIT_LABEL,
    gridsForMedium: (mediumHabitats) => [
      buildUnitChangeGrid({
        columns: UNIT_CHANGE_COLUMNS,
        rows: mediumHabitats.map(habitatRow)
      })
    ],
    lowColumns: UNIT_CHANGE_COLUMNS,
    rowsForLow: (lowHabitats) => lowHabitats.map(habitatRow),
    showLowTotals: false
  })
}

export const getController = createTradingSummaryController({
  view: 'watercourses-trading-summary/index',
  summaryPath: WATERCOURSES_SUMMARY_PATH,
  pagePath: WATERCOURSES_TRADING_SUMMARY_PATH,
  pageHeading: PAGE_HEADING,
  buildTrading: buildTradingSections
})
