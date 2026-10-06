import {
  HEDGEROWS_HABITAT_KEY,
  HEDGEROWS_SUMMARY_PATH,
  HEDGEROWS_TRADING_SUMMARY_PATH
} from '../common/helpers/unit-type-navigation.js'
import {
  CUMULATIVE_SURPLUS_LABEL,
  buildBandStatusRows,
  buildLowSection,
  buildMediumSection,
  buildUnitChangeGrid,
  createTradingSummaryController,
  habitatsIn,
  summaryTile,
  unitChangeCell
} from '../common/helpers/trading-summary.js'

const PAGE_HEADING = 'Hedgerows trading summary'
const MEDIUM_DEFICIT_LABEL =
  'Medium distinctiveness unit deficit required to meet trading rules'
const VERY_LOW_NET_CHANGE_LABEL = 'Very low distinctiveness net change in units'
const AVAILABLE_FOR_VERY_LOW_LABEL =
  'Medium and low units available to offset very low distinctiveness deficit'
const UNIT_CHANGE_COLUMNS = ['Habitat type', 'Unit change']
const TOTAL_UNIT_CHANGE = 'Total unit change'

// Bands as the reference data spells them.
const MEDIUM = 'Medium'
const LOW = 'Low'
const VERY_LOW = 'V.Low'

function habitatRow(habitat) {
  return [{ text: habitat.habitatType }, unitChangeCell(habitat.netUnitChange)]
}

function unitChangeGrid(habitats, total) {
  return buildUnitChangeGrid({
    columns: UNIT_CHANGE_COLUMNS,
    rows: habitats.map(habitatRow),
    totalsLabel: TOTAL_UNIT_CHANGE,
    totalsValue: total
  })
}

/**
 * The units a band makes available to the band below it: its figure when
 * positive, otherwise none. A deficit is never carried down, so a band can't
 * be shown as offsetting the next one with negative units. This is the same
 * cascade bng-library uses to work out the cumulative figures.
 *
 * @param {number | null | undefined} figure
 */
function carriedDown(figure) {
  return Math.max(0, figure ?? 0)
}

/**
 * Hedgerows trade on distinctiveness band alone, with no broad-habitat
 * grouping, across three bands: Medium, Low and Very low. Availability
 * cascades from Medium to Low and from Low to Very low. High and very high
 * distinctiveness are outside these trading rules. Null when no figures were
 * saved.
 */
function buildTradingSections(project) {
  const figures = project?.postIntervention?.tradingRules?.hedgerows

  if (!figures) {
    return null
  }

  const statuses = project?.tradingRuleStatuses?.hedgerows
  const habitats = figures.habitatTypes ?? []
  const mediumHabitats = habitatsIn(habitats, MEDIUM)
  const lowHabitats = habitatsIn(habitats, LOW)
  const veryLowHabitats = habitatsIn(habitats, VERY_LOW)

  return {
    statusRows: buildBandStatusRows(
      [
        { label: 'Medium', key: 'medium', present: mediumHabitats.length > 0 },
        { label: 'Low', key: 'low', present: lowHabitats.length > 0 },
        {
          label: 'Very low',
          key: 'veryLow',
          present: veryLowHabitats.length > 0
        }
      ],
      statuses
    ),
    medium:
      mediumHabitats.length > 0
        ? buildMediumSection({
            deficit: figures.medium?.netUnitChange,
            deficitLabel: MEDIUM_DEFICIT_LABEL,
            status: statuses?.medium,
            grids: [
              unitChangeGrid(mediumHabitats, figures.medium?.netUnitChange)
            ]
          })
        : null,
    low:
      lowHabitats.length > 0
        ? buildLowSection({
            netUnitChange: figures.low?.netUnitChange,
            mediumSurplus: carriedDown(figures.medium?.netUnitChange),
            cumulativeAvailability: figures.low?.cumulativeAvailability,
            status: statuses?.low,
            columns: UNIT_CHANGE_COLUMNS,
            rows: lowHabitats.map(habitatRow),
            totalsLabel: TOTAL_UNIT_CHANGE
          })
        : null,
    veryLow:
      veryLowHabitats.length > 0
        ? {
            tiles: [
              summaryTile(
                VERY_LOW_NET_CHANGE_LABEL,
                figures.veryLow?.netUnitChange
              ),
              summaryTile(
                AVAILABLE_FOR_VERY_LOW_LABEL,
                carriedDown(figures.low?.cumulativeAvailability)
              ),
              summaryTile(
                CUMULATIVE_SURPLUS_LABEL,
                figures.veryLow?.cumulativeAvailability,
                statuses?.veryLow
              )
            ],
            grid: unitChangeGrid(
              veryLowHabitats,
              figures.veryLow?.netUnitChange
            )
          }
        : null
  }
}

export const getController = createTradingSummaryController({
  view: 'hedgerows-trading-summary/index',
  summaryPath: HEDGEROWS_SUMMARY_PATH,
  pagePath: HEDGEROWS_TRADING_SUMMARY_PATH,
  pageHeading: PAGE_HEADING,
  habitatKey: HEDGEROWS_HABITAT_KEY,
  buildTrading: buildTradingSections
})
