import { isFiniteNumber } from './unit-summary.js'
import { formatHabitatUnits } from './format-habitat-values.js'
import { HABITAT_UPLOAD_TYPES } from './habitat-upload-types.js'

const EMPTY_DISPLAY = ''
const REF_SORT_LOCALE = 'en'
// MoJ's SortableTable compares a non-numeric data-sort-value with a plain
// localeCompare, which would put 'P-10' before 'P-2'. Zero-padding each run of
// digits keeps a Ref click in the order the server rendered.
const SORT_KEY_DIGIT_WIDTH = 10
const TOTALS_LABEL = 'Total'
const BOLD_CELL_CLASS = 'govuk-!-font-weight-bold'
// Strategic significance is fixed at Low (1) for MVS (BMD-315 AC9), matching the
// baseline and post-intervention details pages. The engine hardcodes the baseline
// multiplier to 1, so the uploaded category must not be shown against these units.
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'

function featureRef(feature) {
  const ref = feature?.ref?.trim()
  return ref || feature?.featureId || EMPTY_DISPLAY
}

function compareFeatureRefs(left, right) {
  return featureRef(left).localeCompare(featureRef(right), REF_SORT_LOCALE, {
    numeric: true
  })
}

function refSortValue(reference) {
  return reference.replaceAll(/\d+/g, (digits) =>
    digits.padStart(SORT_KEY_DIGIT_WIDTH, '0')
  )
}

function sortBaselineFeatures(features) {
  return [...features].sort(compareFeatureRefs)
}

function habitatDetailsHref(featureId, projectId) {
  const params = new URLSearchParams({
    featureId,
    projectId
  })
  return `/${HABITAT_UPLOAD_TYPES.baseline.detailsRoute}?${params.toString()}`
}

function withScore(label, score) {
  return `${label} (${score})`
}

function formatLabelAndScore(label, score) {
  if (label == null || label === EMPTY_DISPLAY) {
    return EMPTY_DISPLAY
  }

  if (isFiniteNumber(score)) {
    return withScore(label, score)
  }

  return String(label)
}

function textCell(text) {
  return { text: text ?? EMPTY_DISPLAY }
}

function numericCell(text, sortValue) {
  const cell = { text, numeric: true }

  if (isFiniteNumber(sortValue)) {
    cell.attributes = { 'data-sort-value': sortValue }
  }

  return cell
}

function buildRefCell(feature, projectId) {
  const reference = featureRef(feature)
  const cell = {
    text: reference,
    attributes: { 'data-sort-value': refSortValue(reference) }
  }

  if (feature.featureId) {
    cell.href = habitatDetailsHref(feature.featureId, projectId)
  }

  return cell
}

function boldCell(cell) {
  return { ...cell, classes: BOLD_CELL_CLASS }
}

function sumFinite(features, readValue) {
  return features.reduce((total, feature) => {
    const value = readValue(feature)

    if (isFiniteNumber(value)) {
      return total + value
    }

    return total
  }, 0)
}

const BROAD_HABITAT_HEADER = 'Broad habitat'

const BROAD_HABITAT_COLUMN = {
  text: BROAD_HABITAT_HEADER,
  cell: (feature) => textCell(feature.broadType)
}

function buildColumns({ readSize, formatSize, formatSizeTotal, extraColumns }) {
  return [
    {
      text: 'Ref',
      cell: buildRefCell,
      total: () => boldCell(textCell(TOTALS_LABEL))
    },
    {
      text: 'Units',
      numeric: true,
      cell: (feature) =>
        numericCell(formatHabitatUnits(feature.units), feature.units),
      total: (totals) => boldCell(numericCell(formatHabitatUnits(totals.units)))
    },
    {
      text: 'Size',
      numeric: true,
      cell: (feature) =>
        numericCell(formatSize(readSize(feature)), readSize(feature)),
      total: (totals) => boldCell(numericCell(formatSizeTotal(totals.size)))
    },
    ...extraColumns,
    {
      text: 'Habitat type',
      cell: (feature) => textCell(feature.type)
    },
    {
      text: 'Distinctiveness',
      cell: (feature) =>
        textCell(
          formatLabelAndScore(
            feature.distinctiveness,
            feature.distinctivenessScore
          )
        )
    },
    {
      text: 'Condition',
      cell: (feature) =>
        textCell(formatLabelAndScore(feature.condition, feature.conditionScore))
    },
    {
      text: 'Strategic significance',
      cell: () => textCell(FIXED_STRATEGIC_SIGNIFICANCE)
    }
  ]
}

/**
 * Build the habitat-details grid (header, body rows and totals) for a baseline
 * page. Size display is supplied by the caller so area (ha) and linear (km)
 * pages can share the rest of the table.
 *
 * @param {object} options
 * @param {object[]} options.features
 * @param {string} options.projectId
 * @param {(feature: object) => number|null|undefined} options.readSize
 * @param {(value: number|null|undefined) => string} options.formatSize
 * @param {(value: number|null|undefined) => string} options.formatSizeTotal
 * @param {object[]} [options.extraColumns]
 */
function buildBaselineHabitatGrid({
  features,
  projectId,
  readSize,
  formatSize,
  formatSizeTotal,
  extraColumns = []
}) {
  const columns = buildColumns({
    readSize,
    formatSize,
    formatSizeTotal,
    extraColumns
  })
  const totals = {
    units: sumFinite(features, (feature) => feature.units),
    size: sumFinite(features, readSize)
  }

  return {
    columns: columns.map(({ text, numeric }) => ({ text, numeric })),
    habitatRows: features.map((feature) =>
      columns.map((column) => column.cell(feature, projectId))
    ),
    totalsRow: columns.map((column) => column.total?.(totals) ?? textCell())
  }
}

export {
  BROAD_HABITAT_COLUMN,
  BROAD_HABITAT_HEADER,
  buildBaselineHabitatGrid,
  sortBaselineFeatures
}
