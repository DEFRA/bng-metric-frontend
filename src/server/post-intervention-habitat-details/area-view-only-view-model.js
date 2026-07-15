import { formatAreaHectares } from '../common/helpers/format-habitat-values.js'
import { AREAS_TAB_ANCHOR } from './constants.js'
import { buildViewOnlyViewModel } from './view-only-shared.js'

// What sets the area page apart: hectares rather than a length, and a broad
// habitat above the habitat type.
const areaSpec = {
  tabAnchor: AREAS_TAB_ANCHOR,
  formatSize: (feature) => formatAreaHectares(feature.sizeSquareMetres),
  extraFields: ({ retained }) => ({
    broadHabitatDisplay: retained('broadType')
  })
}

/**
 * Build the read-only view model for a retained post-intervention area habitat.
 * All values are display strings; habitat-details/pi-habitat-details.njk renders
 * them as a govukSummaryList with no form controls.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildAreaViewOnlyViewModel(feature, ctx) {
  return buildViewOnlyViewModel(feature, ctx, areaSpec)
}
