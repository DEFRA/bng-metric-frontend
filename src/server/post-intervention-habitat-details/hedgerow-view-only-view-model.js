import { formatLengthKm } from '../common/helpers/format-habitat-values.js'
import { HEDGEROWS_TAB_ANCHOR } from './constants.js'
import { buildViewOnlyViewModel } from './view-only-shared.js'

// What sets the hedgerow page apart: a length in km, and nothing else — it
// shows only the fields every view-only page shares.
const hedgerowSpec = {
  tabAnchor: HEDGEROWS_TAB_ANCHOR,
  formatSize: (feature) => formatLengthKm(feature.sizeMetres)
}

/**
 * Build the read-only view model for a retained post-intervention hedgerow
 * habitat. All values are display strings; habitat-details/pi-hedgerow-details.njk
 * renders them as a govukSummaryList with no form controls.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildHedgerowViewOnlyViewModel(feature, ctx) {
  return buildViewOnlyViewModel(feature, ctx, hedgerowSpec)
}
