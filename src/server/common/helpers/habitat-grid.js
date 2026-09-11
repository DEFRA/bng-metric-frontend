import { isFiniteNumber } from './unit-summary.js'

const EMPTY_DISPLAY = ''
const TOTALS_LABEL = 'Total'
// Strategic significance is fixed at Low (1) for MVS (BMD-315 AC9), matching the
// baseline and post-intervention details pages. The engine hardcodes the
// multiplier to 1, so the uploaded category must not be shown against these units.
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'
const BOLD_CELL_CLASS = 'govuk-!-font-weight-bold'
const REF_SORT_LOCALE = 'en'
// MoJ's SortableTable compares a non-numeric data-sort-value with a plain
// localeCompare, which would put 'P-10' before 'P-2'. Zero-padding each run of
// digits keeps a Ref click in the order the server rendered.
const SORT_KEY_DIGIT_WIDTH = 10

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

function sortHabitatFeatures(features) {
  return [...features].sort(compareFeatureRefs)
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

function detailsHref(detailsRoute, featureId, projectId) {
  const params = new URLSearchParams({
    featureId,
    projectId
  })
  return `/${detailsRoute}?${params.toString()}`
}

function buildRefCell(feature, projectId, detailsRoute) {
  const reference = featureRef(feature)
  const cell = {
    text: reference,
    attributes: { 'data-sort-value': refSortValue(reference) }
  }

  if (feature.featureId) {
    cell.href = detailsHref(detailsRoute, feature.featureId, projectId)
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

/**
 * Assemble header, body and totals from column definitions.
 *
 * @param {object} options
 * @param {object[]} options.columns
 * @param {object[]} options.features
 * @param {string} options.projectId
 * @param {(feature: object) => number|null|undefined} options.readSize
 */
function buildHabitatGrid({ columns, features, projectId, readSize }) {
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
  EMPTY_DISPLAY,
  FIXED_STRATEGIC_SIGNIFICANCE,
  TOTALS_LABEL,
  boldCell,
  buildHabitatGrid,
  buildRefCell,
  formatLabelAndScore,
  numericCell,
  sortHabitatFeatures,
  textCell
}
