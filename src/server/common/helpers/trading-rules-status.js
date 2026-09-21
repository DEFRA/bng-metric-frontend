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
 * The persisted area-habitat trading-rules status for a project, as a GOV.UK
 * tag, or null when there is nothing to show.
 *
 * Null covers a project with no post-intervention upload yet, and one uploaded
 * before the status was calculated. The pages render no tag at all in that
 * case rather than guessing at Met or Not met.
 *
 * @param {object} project the project document
 * @returns {{ text: string, classes: string }|null}
 */
export function areaTradingRulesStatus(project) {
  const status =
    project?.postIntervention?.tradingRules?.areaHabitats?.statuses
      ?.areaHabitats

  if (status !== MET && status !== NOT_MET) {
    return null
  }

  return { text: status, classes: TAG_CLASSES[status] }
}

export { MET as TRADING_RULES_MET, NOT_MET as TRADING_RULES_NOT_MET }
