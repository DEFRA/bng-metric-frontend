import { formatLengthKm } from '../common/helpers/format-habitat-values.js'
import { WATERCOURSES_TAB_ANCHOR } from './constants.js'
import { buildViewOnlyViewModel, withMultiplier } from './view-only-shared.js'

// What sets the watercourse page apart: a length in km, plus the two
// encroachment rows.
//
// The encroachment *values* come from the baseline side (falling back to
// proposed), because for a retained watercourse the backend feeds the engine
// `baseline.watercourseEncroachment` / `baseline.riparianEncroachment` — the
// multipliers it writes onto `proposed` are derived from those, not from the
// proposed encroachment columns. Reading the value and its multiplier from
// different sides would pair a value with a multiplier that was not computed
// from it, or blank the row entirely when the proposed column is empty.
const watercourseSpec = {
  tabAnchor: WATERCOURSES_TAB_ANCHOR,
  formatSize: (feature) => formatLengthKm(feature.sizeMetres),
  extraFields: ({ proposed, retained }) => ({
    watercourseEncroachmentDisplay: withMultiplier(
      retained('watercourseEncroachment'),
      proposed.waterEncroachmentMultiplier
    ),
    riparianEncroachmentDisplay: withMultiplier(
      retained('riparianEncroachment'),
      proposed.riparianEncroachmentMultiplier
    )
  })
}

/**
 * Build the read-only view model for a retained post-intervention watercourse
 * habitat. All values are display strings;
 * habitat-details/pi-watercourse-details.njk renders them as a govukSummaryList
 * with no form controls.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildWatercourseViewOnlyViewModel(feature, ctx) {
  return buildViewOnlyViewModel(feature, ctx, watercourseSpec)
}
