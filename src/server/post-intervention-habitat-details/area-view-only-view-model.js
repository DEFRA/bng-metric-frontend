import { formatAreaHectares } from '../common/helpers/format-habitat-values.js'
import { AREAS_TAB_ANCHOR } from './constants.js'
import { buildSharedPiViewOnlyFields } from './view-only-shared.js'

/**
 * Build the read-only view model for a retained post-intervention area habitat.
 * All values are display strings; habitat-details/pi-habitat-details.njk renders
 * them as a govukSummaryList with no form controls.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildAreaViewOnlyViewModel(
  feature,
  { projectId, projectName, baselineFeatureId }
) {
  const proposed = feature.proposed ?? {}
  return {
    ...buildSharedPiViewOnlyFields(feature, {
      projectId,
      projectName,
      baselineFeatureId,
      listTabAnchor: AREAS_TAB_ANCHOR
    }),
    sizeDisplay: formatAreaHectares(feature.sizeSquareMetres),
    broadHabitatDisplay: proposed.broadType ?? '',
    habitatTypeDisplay: proposed.type ?? ''
  }
}
