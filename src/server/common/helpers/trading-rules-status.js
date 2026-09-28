/**
 * Display shape for the trading-rules status the backend derives.
 *
 * Nothing is decided here. The verdict is worked out once, in the engine, and
 * served on the project response — this file only turns it into a GOV.UK tag.
 * That matters because the rule is easy to get wrong in a way that wrongly
 * reports "Met": a Low band can pass while Medium fails, and showing the Low
 * band would tell a site it is compliant when it is not. Reading the site-wide
 * `overall` verdict is the only safe thing to do with it.
 */

const MET = 'Met'
const NOT_MET = 'Not met'
const AREA_HABITATS_KEY = 'areaHabitats'
const WATERCOURSES_KEY = 'watercourses'

const TAG_CLASSES = {
  [MET]: 'govuk-tag--green',
  [NOT_MET]: 'govuk-tag--red'
}

/**
 * A unit type's trading-rules status as a GOV.UK tag, or null for no tag.
 *
 * Reads `overall` — the site-wide verdict, not either band.
 *
 * Null means the backend had no verdict to give: a post-intervention file was
 * uploaded but its figures were never calculated, or trading rules do not
 * apply (for watercourses, PI-only with no baseline). Unknown is not failed,
 * so the pages show no tag rather than a red one claiming the site was
 * assessed. A project with no post-intervention file at all is not this case
 * — the backend returns Not met for it, because nothing has been delivered to
 * trade against.
 *
 * @param {{ overall?: string|null }|null|undefined} statuses
 * @returns {{ text: string, classes: string }|null}
 */
function tradingRulesStatusFor(statuses) {
  return tradingRulesStatusTag(statuses?.overall)
}

/**
 * A single Met / Not met status, as served by the backend, as a GOV.UK tag.
 *
 * @param {string|null|undefined} status
 * @returns {{ text: string, classes: string }|null} null for anything else
 */
export function tradingRulesStatusTag(status) {
  if (status !== MET && status !== NOT_MET) {
    return null
  }

  return { text: status, classes: TAG_CLASSES[status] }
}

/**
 * @param {object} project the project, as returned by `fetchProjectOrThrow`
 * @returns {{ text: string, classes: string }|null}
 */
export function areaTradingRulesStatus(project) {
  return tradingRulesStatusFor(
    project?.tradingRuleStatuses?.[AREA_HABITATS_KEY]
  )
}

/**
 * @param {object} project the project, as returned by `fetchProjectOrThrow`
 * @returns {{ text: string, classes: string }|null}
 */
export function watercourseTradingRulesStatus(project) {
  return tradingRulesStatusFor(project?.tradingRuleStatuses?.[WATERCOURSES_KEY])
}

export { MET as TRADING_RULES_MET, NOT_MET as TRADING_RULES_NOT_MET }
