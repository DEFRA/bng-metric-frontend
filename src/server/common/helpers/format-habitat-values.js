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
const LENGTH_TOTAL_SIGNIFICANT_FIGURES = 7
const HABITAT_UNITS_DECIMAL_PLACES = 2
const HABITAT_UNITS_SIGNIFICANT_FIGURES = 7
const KM_UNIT = 'km'

const EMPTY_DISPLAY = ''
const NO_DATA_DISPLAY = 'No data'

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

/**
 * Convert a metres length to a display string in kilometres, rounded to 7
 * significant figures (BMD-500 AC4). Returns '' for null/undefined/non-finite.
 *
 * @param {number|null|undefined} metres
 * @returns {string}
 */
function formatLengthKm(metres) {
  if (!isUsableNumber(metres)) {
    return EMPTY_DISPLAY
  }
  const kilometres = metres / METRES_PER_KILOMETRE
  return Number(kilometres.toPrecision(LENGTH_SIGNIFICANT_FIGURES)).toString()
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
 * value with the "km" suffix (no space between number and suffix). Returns
 * "No data" when the total is zero or missing — the summary cells for
 * hedgerows/watercourses show "No data" when no habitats of that type were
 * present on the import.
 *
 * @param {number|null|undefined} metres
 * @returns {string}
 */
function formatTotalLengthSize(metres) {
  if (!isUsableNumber(metres) || metres === 0) {
    return NO_DATA_DISPLAY
  }
  const kilometres = metres / METRES_PER_KILOMETRE
  const rounded = Number(
    kilometres.toPrecision(LENGTH_TOTAL_SIGNIFICANT_FIGURES)
  )
  return `${rounded}${KM_UNIT}`
}

export {
  formatAreaHectares,
  formatLengthKm,
  formatHabitatUnits,
  formatTotalAreaSize,
  formatTotalLengthSize,
  KM_UNIT
}
