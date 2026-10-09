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
// BMD-1058 AC6: the grids show at most this many characters of a reference,
// then an ellipsis. Showing the whole reference on hover is a separate ticket.
const MAX_REF_DISPLAY_LENGTH = 10
const TRUNCATION_MARK = '…'

function featureRef(feature) {
  const ref = feature?.ref?.trim()
  return ref || feature?.featureId || EMPTY_DISPLAY
}

function compareFeatureRefs(left, right) {
  return featureRef(left).localeCompare(featureRef(right), REF_SORT_LOCALE, {
    numeric: true
  })
}

/**
 * A reference longer than a grid shows, split where the grid cuts it: the
 * first MAX_REF_DISPLAY_LENGTH characters, shown, and the rest, which the
 * macro keeps for assistive technology. Null when it fits. Characters are
 * counted as code points, so the cut never splits one in two.
 *
 * @param {string} reference
 * @returns {{ shown: string, hidden: string, mark: string } | null}
 */
function splitRef(reference) {
  const characters = Array.from(reference)
  if (characters.length <= MAX_REF_DISPLAY_LENGTH) {
    return null
  }
  return {
    shown: characters.slice(0, MAX_REF_DISPLAY_LENGTH).join(''),
    hidden: characters.slice(MAX_REF_DISPLAY_LENGTH).join(''),
    mark: TRUNCATION_MARK
  }
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

function detailsHref(detailsRoute, featureId, projectId, returnUrl) {
  const params = new URLSearchParams({
    featureId,
    projectId
  })
  if (returnUrl) {
    params.set('returnUrl', returnUrl)
  }
  return `/${detailsRoute}?${params.toString()}`
}

function buildRefCell(feature, projectId, detailsRoute, returnUrl) {
  const reference = featureRef(feature)
  // Only a real reference is cut short, and only its text: the grid still
  // sorts on the whole reference. The featureId shown in place of a blank one
  // is not a reference, so it is shown whole.
  const split = feature?.ref?.trim() ? splitRef(reference) : null
  const cell = {
    text: split ? `${split.shown}${split.mark}` : reference,
    attributes: { 'data-sort-value': refSortValue(reference) }
  }
  // The macro renders a cut reference so that assistive technology still
  // hears all of it: the link's name is the whole reference, and starts with
  // the text on screen. Showing it on hover is a separate ticket.
  if (split) {
    cell.truncated = split
  }

  if (feature.featureId) {
    cell.href = detailsHref(
      detailsRoute,
      feature.featureId,
      projectId,
      returnUrl
    )
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
