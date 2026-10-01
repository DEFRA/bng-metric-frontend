import { DEFAULT_PROJECT_NAME } from '../constants.js'
import { fetchProjectOrThrow } from './fetch-project.js'
import { hasBaselineData } from './project-state.js'
import { tradingRulesStatusTag } from './trading-rules-status.js'
import { formatUnits } from './unit-summary.js'
import {
  buildUnitTypeNavigation,
  projectPageHref
} from './unit-type-navigation.js'
import { uploadFileHref } from './upload-file-navigation.js'

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

/**
 * Medium and Low sections for one unit type. High and very high
 * distinctiveness are outside these trading rules. Null when no figures were
 * saved.
 */
function buildDistinctivenessSections({
  figures,
  statuses,
  habitats,
  deficitLabel,
  gridsForMedium,
  lowColumns,
  rowsForLow,
  showLowTotals = true
}) {
  if (!figures) {
    return null
  }

  const mediumHabitats = habitatsIn(habitats, MEDIUM)
  const lowHabitats = habitatsIn(habitats, LOW)
  const hasMedium = mediumHabitats.length > 0
  const hasLow = lowHabitats.length > 0

  return {
    statusRows: buildBandStatusRows(
      [
        { label: MEDIUM, key: 'medium', present: hasMedium },
        { label: LOW, key: 'low', present: hasLow }
      ],
      statuses
    ),
    medium: hasMedium
      ? buildMediumSection({
          deficit: figures.medium?.deficit,
          deficitLabel,
          status: statuses?.medium,
          grids: gridsForMedium(mediumHabitats)
        })
      : null,
    low: hasLow
      ? buildLowSection({
          netUnitChange: figures.low?.netUnitChange,
          mediumSurplus: figures.medium?.surplus,
          cumulativeAvailability: figures.low?.cumulativeAvailability,
          columns: lowColumns,
          rows: rowsForLow(lowHabitats),
          showTotals: showLowTotals
        })
      : null
  }
}

function buildTradingSummaryView({
  project,
  projectId,
  pagePath,
  heading,
  trading
}) {
  const pageHref = projectPageHref(projectId, pagePath)

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    heading,
    uploadHref: uploadFileHref(projectId, pageHref),
    navigationItems: buildUnitTypeNavigation(project, projectId, pageHref),
    trading
  }
}

function createTradingSummaryController({
  view,
  summaryPath,
  pagePath,
  pageHeading,
  buildTrading
}) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const project = await fetchProjectOrThrow(request, id)

      if (!hasBaselineData(project)) {
        return h.redirect(`/add-project-details/${id}`)
      }

      // Nothing has been delivered to trade against until a post-intervention
      // file is uploaded.
      if (!project.postIntervention) {
        return h.redirect(projectPageHref(id, summaryPath))
      }

      return h.view(view, {
        pageTitle: pageHeading,
        ...buildTradingSummaryView({
          project,
          projectId: id,
          pagePath,
          heading: pageHeading,
          trading: buildTrading(project)
        })
      })
    }
  }
}

export {
  buildDistinctivenessSections,
  buildUnitChangeGrid,
  createTradingSummaryController,
  unitChangeCell
}
