import { formatLengthKm } from '../common/helpers/format-habitat-values.js'
import { HEDGEROWS_TAB_ANCHOR } from './constants.js'
import { buildSharedPiViewOnlyFields } from './view-only-shared.js'

/**
 * Build the read-only view model for a retained post-intervention hedgerow
 * habitat. All values are display strings; habitat-details/pi-hedgerow-details.njk
 * renders them as a govukSummaryList with no form controls.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildHedgerowViewOnlyViewModel(
  feature,
  { projectId, projectName, baselineFeatureId }
) {
  const proposed = feature.proposed ?? {}
  return {
    ...buildSharedPiViewOnlyFields(feature, {
      projectId,
      projectName,
      baselineFeatureId,
      listTabAnchor: HEDGEROWS_TAB_ANCHOR
    }),
    sizeDisplay: formatLengthKm(feature.sizeMetres),
    habitatTypeDisplay: proposed.type ?? ''
  }
}
