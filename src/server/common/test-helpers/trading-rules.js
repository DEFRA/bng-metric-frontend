const TILE_SELECTOR = '.app-unit-type-summary__tile'

/**
 * Finds the unit type summary tile with the given heading.
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} heading
 */
export const tileByHeading = ($, heading) =>
  $(TILE_SELECTOR).filter(
    (_, tile) => $(tile).find('h3').first().text().trim() === heading
  )

/**
 * Adds a trading rules verdict for one unit type to a project payload. The
 * bands deliberately disagree with each other, so a page that reads a band
 * instead of `overall` fails its test.
 * @param {object} project
 * @param {string} unitType - key in `tradingRuleStatuses`, e.g. 'hedgerows'
 * @param {string | null} overall
 */
export const withTradingRuleStatus = (project, unitType, overall) => ({
  ...project,
  tradingRuleStatuses: {
    [unitType]: { medium: 'Met', low: 'Not met', veryLow: 'Met', overall }
  }
})
