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
 * Lists each tile in a section as `[heading, figure, status tag]`, with an
 * empty string for a tile that carries no tag.
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio<any>} section
 */
export const tilesIn = ($, section) =>
  section
    .find(TILE_SELECTOR)
    .map((_, tile) => [
      [
        $(tile).find('h3').text(),
        $(tile).find('p').text(),
        $(tile).find('.govuk-tag').text()
      ]
    ])
    .get()

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
