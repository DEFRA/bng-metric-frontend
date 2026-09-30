import {
  AREA_SUMMARY_PATH,
  AREA_TRADING_SUMMARY_PATH
} from '../common/helpers/unit-type-navigation.js'
import {
  buildDistinctivenessSections,
  buildUnitChangeGrid,
  createTradingSummaryController,
  unitChangeCell
} from '../common/helpers/trading-summary.js'

const PAGE_HEADING = 'Area habitats trading summary'
const MEDIUM_DEFICIT_LABEL =
  'Medium distinctiveness unit deficit required to meet trading rules'

// The backend cumulates the Medium habitats of both intertidal broad habitats
// under this one key, because the trading rules treat them as one broad
// habitat. The page shows that group in its own grid, with each habitat's own
// broad habitat beside it.
const MERGED_INTERTIDAL_BROAD_HABITAT =
  'Intertidal sediment and hard structures'
const INTERTIDAL_HEADING = 'Intertidal sediment and Intertidal hard structures'

const HABITAT_TYPE_SEPARATOR = ' - '

/**
 * The habitat type without its broad habitat. The engine keys habitats as
 * "{Broad habitat} - {Habitat type}", and every grid on this page already shows
 * the broad habitat, as a heading or a column of its own.
 */
function habitatTypeText({ habitatType, broadHabitat }) {
  const prefix = `${broadHabitat}${HABITAT_TYPE_SEPARATOR}`
  return habitatType.startsWith(prefix)
    ? habitatType.slice(prefix.length)
    : habitatType
}

function habitatRow(habitat, { includeBroadHabitat = false } = {}) {
  const cells = []

  if (includeBroadHabitat) {
    cells.push({ text: habitat.broadHabitat })
  }

  cells.push(
    { text: habitatTypeText(habitat) },
    unitChangeCell(habitat.netUnitChange)
  )
  return cells
}

function habitatsCumulatedUnder(broadHabitat, mediumHabitats) {
  return mediumHabitats.filter(
    (habitat) => habitat.tradingBroadHabitat === broadHabitat.broadHabitat
  )
}

const BROAD_HABITAT_COLUMNS = ['Habitat type', 'Unit change']
const BROAD_AND_TYPE_COLUMNS = [
  'Broad habitat',
  'Habitat type',
  'On-site unit change'
]
const TOTAL_BROAD_HABITAT_CHANGE = 'Total broad habitat change'

function buildBroadHabitatGrid(broadHabitat, mediumHabitats) {
  return buildUnitChangeGrid({
    heading: broadHabitat.broadHabitat,
    columns: BROAD_HABITAT_COLUMNS,
    rows: habitatsCumulatedUnder(broadHabitat, mediumHabitats).map((habitat) =>
      habitatRow(habitat)
    ),
    totalsLabel: TOTAL_BROAD_HABITAT_CHANGE,
    totalsValue: broadHabitat.netUnitChange
  })
}

function buildIntertidalGrid(broadHabitat, mediumHabitats) {
  return buildUnitChangeGrid({
    heading: INTERTIDAL_HEADING,
    columns: BROAD_AND_TYPE_COLUMNS,
    rows: habitatsCumulatedUnder(broadHabitat, mediumHabitats).map((habitat) =>
      habitatRow(habitat, { includeBroadHabitat: true })
    ),
    totalsLabel: TOTAL_BROAD_HABITAT_CHANGE,
    totalsValue: broadHabitat.netUnitChange
  })
}

function mediumGrids(figures, mediumHabitats) {
  const broadHabitats = figures.medium?.broadHabitats ?? []
  const intertidal = broadHabitats.find(
    (entry) => entry.broadHabitat === MERGED_INTERTIDAL_BROAD_HABITAT
  )
  const grids = broadHabitats
    .filter((entry) => entry !== intertidal)
    .map((entry) => buildBroadHabitatGrid(entry, mediumHabitats))

  if (intertidal) {
    grids.push(buildIntertidalGrid(intertidal, mediumHabitats))
  }

  return grids
}

function buildTradingSections(project) {
  const figures = project?.postIntervention?.tradingRules?.areaHabitats

  return buildDistinctivenessSections({
    figures,
    statuses: project?.tradingRuleStatuses?.areaHabitats,
    habitats: figures?.habitatTypes ?? [],
    deficitLabel: MEDIUM_DEFICIT_LABEL,
    gridsForMedium: (mediumHabitats) => mediumGrids(figures, mediumHabitats),
    lowColumns: BROAD_AND_TYPE_COLUMNS,
    rowsForLow: (lowHabitats) =>
      lowHabitats.map((habitat) =>
        habitatRow(habitat, { includeBroadHabitat: true })
      )
  })
}

export const getController = createTradingSummaryController({
  view: 'area-trading-summary/index',
  summaryPath: AREA_SUMMARY_PATH,
  pagePath: AREA_TRADING_SUMMARY_PATH,
  pageHeading: PAGE_HEADING,
  buildTrading: buildTradingSections
})
