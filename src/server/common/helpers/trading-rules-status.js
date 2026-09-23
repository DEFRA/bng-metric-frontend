/**
 * Display shape for the trading-rules status the backend derives.
 *
 * Nothing is decided here. The verdict is worked out once, in the engine, and
 * served on the project response — this file only turns it into a GOV.UK tag.
 * That matters because the rule is easy to get wrong in a way that wrongly
 * reports "Met": the Low band figure deliberately ignores a Medium deficit the
 * statutory metric nets off, and is sound only when paired with the Medium
 * band. Reading the site-wide verdict is the only safe thing to do with it.
 */

const MET = 'Met'
const NOT_MET = 'Not met'

const TAG_CLASSES = {
  [MET]: 'govuk-tag--green',
  [NOT_MET]: 'govuk-tag--red'
}

/**
 * The area-habitat trading-rules status as a GOV.UK tag, or null for no tag.
 *
 * Reads `overall` — the site-wide verdict, not either band. The Low band can
 * pass while the site fails, so showing that one would tell a site it is
 * compliant when it is not.
 *
 * Null means the backend had no verdict to give: a post-intervention file was
 * uploaded but its figures were never calculated. Unknown is not failed, so the
 * pages show no tag rather than a red one claiming the site was assessed. A
 * project with no post-intervention file at all is not this case — the backend
 * returns Not met for it, because nothing has been delivered to trade against.
 *
 * @param {object} project the project, as returned by `fetchProjectOrThrow`
 * @returns {{ text: string, classes: string }|null}
 */
export function areaTradingRulesStatus(project) {
  const status = project?.tradingRuleStatuses?.areaHabitats?.overall

  if (status !== MET && status !== NOT_MET) {
    return null
  }

  return { text: status, classes: TAG_CLASSES[status] }
}

export { MET as TRADING_RULES_MET, NOT_MET as TRADING_RULES_NOT_MET }
