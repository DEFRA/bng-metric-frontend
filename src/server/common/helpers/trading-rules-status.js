/**
 * Display shape for the trading-rules status the engine derives.
 *
 * The status itself is calculated in `bng-library` and persisted by the
 * backend. Nothing is derived here: the Low band rule reads a figure that
 * deliberately differs from the metric spreadsheet and is only safe when it is
 * paired with the Medium band rule, so the calculation lives in one place and
 * this file only decides how to draw the answer.
 */

const MET = 'Met'
const NOT_MET = 'Not met'

const TAG_CLASSES = {
  [MET]: 'govuk-tag--green',
  [NOT_MET]: 'govuk-tag--red'
}

/**
 * The area-habitat trading-rules status for a project, as a GOV.UK tag, or
 * null where there is nothing to show.
 *
 * Reads `statuses.overall` — the site-wide status, not either band. The Low
 * band can pass while the site fails, because the figure it reads deliberately
 * ignores a Medium deficit the metric spreadsheet would net off. Showing the
 * Low band here would tell a site it is compliant when it is not.
 *
 * With a baseline but no post-intervention upload the answer is Not met:
 * nothing has been delivered to trade against. The engine says the same, and
 * so does the site report, but a project in that state has no
 * post-intervention document to carry a status, so it is answered here.
 *
 * Null is kept for the one case that is genuinely unknown: a post-intervention
 * upload whose status has not been calculated. No tag at all, rather than
 * guessing at Met or Not met.
 *
 * @param {object} project the project document
 * @returns {{ text: string, classes: string }|null}
 */
export function areaTradingRulesStatus(project) {
  if (!project?.postIntervention) {
    return tag(NOT_MET)
  }

  const status =
    project.postIntervention.tradingRules?.areaHabitats?.statuses?.overall

  if (status !== MET && status !== NOT_MET) {
    return null
  }

  return tag(status)
}

function tag(status) {
  return { text: status, classes: TAG_CLASSES[status] }
}

export { MET as TRADING_RULES_MET, NOT_MET as TRADING_RULES_NOT_MET }
