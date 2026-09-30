import { formatUnits } from './unit-summary.js'
import { tradingRulesStatusTag } from './trading-rules-status.js'

const MEDIUM = 'Medium'
const LOW = 'Low'
const NUMERIC_COLUMN_COUNT = 1
const TOTAL_ON_SITE_UNIT_CHANGE = 'Total on-site unit change'

function unitsText(value) {
  return `${formatUnits(value)} units`
}

function unitChangeCell(value, { bold = false } = {}) {
  return {
    text: formatUnits(value),
    numeric: true,
    classes: bold ? 'govuk-!-font-weight-bold' : undefined
  }
}

function totalLabelCell(text) {
  return { text, classes: 'govuk-!-font-weight-bold' }
}

function habitatsIn(habitats, distinctiveness) {
  return habitats.filter(
    (habitat) => habitat.distinctiveness === distinctiveness
  )
}

function statusRow(text, status) {
  return { text, status: tradingRulesStatusTag(status) }
}

/**
 * One status row per band that is actually present. A band the upload does
 * not contain is omitted rather than shown as a pass.
 *
 * @param {Array<{ label: string, key: string, present: boolean }>} bands
 * @param {object | null | undefined} statuses
 */
function buildBandStatusRows(bands, statuses) {
  return bands
    .filter((band) => band.present)
    .map((band) => statusRow(band.label, statuses?.[band.key]))
}

function buildTotalsRow(label, value, columnCount) {
  const labelColumnCount = columnCount - NUMERIC_COLUMN_COUNT
  const row = [totalLabelCell(label)]

  for (let index = 1; index < labelColumnCount; index += 1) {
    row.push({ text: '' })
  }

  row.push(unitChangeCell(value, { bold: true }))
  return row
}

function buildUnitChangeGrid({
  heading = null,
  columns,
  rows,
  totalsLabel = null,
  totalsValue = null
}) {
  const grid = { heading, columns, rows }

  if (totalsLabel != null) {
    grid.totalsRow = buildTotalsRow(totalsLabel, totalsValue, columns.length)
  }

  return grid
}

function buildMediumSection({ deficit, status, grids, deficitLabel }) {
  return {
    deficit: unitsText(deficit),
    deficitLabel,
    status: tradingRulesStatusTag(status),
    grids
  }
}

function buildLowSection({
  netUnitChange,
  mediumSurplus,
  cumulativeAvailability,
  columns,
  rows,
  showTotals = true
}) {
  return {
    netUnitChange: unitsText(netUnitChange),
    mediumSurplus: unitsText(mediumSurplus),
    cumulativeSurplus: unitsText(cumulativeAvailability),
    grid: buildUnitChangeGrid({
      columns,
      rows,
      ...(showTotals
        ? {
            totalsLabel: TOTAL_ON_SITE_UNIT_CHANGE,
            totalsValue: netUnitChange
          }
        : {})
    })
  }
}

export {
  LOW,
  MEDIUM,
  buildBandStatusRows,
  buildLowSection,
  buildMediumSection,
  buildUnitChangeGrid,
  habitatsIn,
  unitChangeCell
}
