// Display formatting for habitat numeric values on the Habitat Details page.
//
// The backend stores canonical numbers; the frontend decides how many digits
// the user sees. Keeping the rules here means the precision policy is one
// edit away when product confirms it.

const SQUARE_METRES_PER_HECTARE = 10000
const AREA_SIGNIFICANT_FIGURES = 10
const HABITAT_UNITS_DECIMAL_PLACES = 2
const HABITAT_UNITS_SIGNIFICANT_FIGURES = 7

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

export { formatAreaHectares, formatHabitatUnits }
