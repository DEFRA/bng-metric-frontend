// Display formatting for habitat numeric values on the Habitat Details and
// Habitat List pages.
//
// The backend stores canonical numbers; the frontend decides how many digits
// the user sees. Keeping the rules here means the precision policy is one
// edit away when product confirms it.

const SQUARE_METRES_PER_HECTARE = 10000
const METRES_PER_KILOMETRE = 1000
const AREA_SIGNIFICANT_FIGURES = 10
const LENGTH_SIGNIFICANT_FIGURES = 7
const LENGTH_BASELINE_TOTAL_SIGNIFICANT_FIGURES = 10
const HABITAT_UNITS_DECIMAL_PLACES = 2
const HABITAT_UNITS_SIGNIFICANT_FIGURES = 7
const KM_UNIT = 'km'

const EMPTY_DISPLAY = ''

function isUsableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Convert a m² area to a display string in hectares, rounded to 10 significant
 * figures (AC4). Returns '' for null/undefined/non-finite.
 *
 * @param {number|null|undefined} squareMetres
 * @returns {string}
 */
function formatAreaHectares(squareMetres) {
  const value = formatAreaHectaresValue(squareMetres)
  if (value === EMPTY_DISPLAY) {
    return EMPTY_DISPLAY
  }
  return `${value}ha`
}

/**
 * As formatAreaHectares but without the "ha" suffix, for rows whose label
 * already names the unit ("Size (hectares)"). Returns '' for
 * null/undefined/non-finite.
 *
 * @param {number|null|undefined} squareMetres
 * @returns {string}
 */
function formatAreaHectaresValue(squareMetres) {
  if (!isUsableNumber(squareMetres)) {
    return EMPTY_DISPLAY
  }
  const hectares = squareMetres / SQUARE_METRES_PER_HECTARE
  return Number(hectares.toPrecision(AREA_SIGNIFICANT_FIGURES)).toString()
}

/**
 * Format a habitat-units number to 2 decimal places, capped at 7 significant
 * figures (AC11). Returns '' for null/undefined/non-finite.
 *
 * @param {number|null|undefined} units
 * @returns {string}
 */
function formatHabitatUnits(units) {
  if (!isUsableNumber(units)) {
    return EMPTY_DISPLAY
  }
  const capped = Number(units.toPrecision(HABITAT_UNITS_SIGNIFICANT_FIGURES))
  return capped.toFixed(HABITAT_UNITS_DECIMAL_PLACES)
}

function formatKilometres(metres, significantFigures) {
  if (!isUsableNumber(metres)) {
    return EMPTY_DISPLAY
  }
  const kilometres = metres / METRES_PER_KILOMETRE
  return Number(kilometres.toPrecision(significantFigures)).toString()
}

function withKmSuffix(value) {
  if (value === EMPTY_DISPLAY) {
    return EMPTY_DISPLAY
  }
  return `${value}${KM_UNIT}`
}

/**
 * Convert a metres length to a display string in kilometres, rounded to 7
 * significant figures (BMD-500 AC4). Returns '' for null/undefined/non-finite.
 *
 * @param {number|null|undefined} metres
 * @returns {string}
 */
function formatLengthKm(metres) {
  return formatKilometres(metres, LENGTH_SIGNIFICANT_FIGURES)
}

/**
 * As formatLengthKm but with the "km" suffix (no space), for baseline grid
 * size cells.
 *
 * @param {number|null|undefined} metres
 * @returns {string}
 */
function formatLengthKmDisplay(metres) {
  return withKmSuffix(formatLengthKm(metres))
}

/**
 * Format a total area for the Habitat List summary as a hectare value with
 * the "ha" suffix (no space between number and suffix). Returns '' for
 * null/undefined/non-finite input.
 *
 * @param {number|null|undefined} squareMetres
 * @returns {string}
 */
function formatTotalAreaSize(squareMetres) {
  if (!isUsableNumber(squareMetres)) {
    return EMPTY_DISPLAY
  }
  const hectares = squareMetres / SQUARE_METRES_PER_HECTARE
  const rounded = Number(hectares.toPrecision(AREA_SIGNIFICANT_FIGURES))
  return `${rounded}ha`
}

/**
 * Format a total linear length for the Habitat List summary as a kilometre
 * value with the "km" suffix (no space between number and suffix). Habitat
 * presence is handled by the caller; missing numeric values remain empty.
 *
 * @param {number|null|undefined} metres
 * @returns {string}
 */
function formatTotalLengthSize(metres) {
  return withKmSuffix(formatKilometres(metres, LENGTH_SIGNIFICANT_FIGURES))
}

/**
 * Format a summed linear length for a baseline details grid as kilometres
 * to 10 significant figures, with the "km" suffix (no space).
 *
 * @param {number|null|undefined} metres
 * @returns {string}
 */
function formatBaselineTotalLengthSize(metres) {
  return withKmSuffix(
    formatKilometres(metres, LENGTH_BASELINE_TOTAL_SIGNIFICANT_FIGURES)
  )
}

export {
  formatAreaHectares,
  formatAreaHectaresValue,
  formatBaselineTotalLengthSize,
  formatLengthKm,
  formatLengthKmDisplay,
  formatHabitatUnits,
  formatTotalAreaSize,
  formatTotalLengthSize,
  KM_UNIT
}
