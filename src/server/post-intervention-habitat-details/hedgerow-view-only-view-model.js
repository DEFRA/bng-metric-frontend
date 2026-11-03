import { formatLengthKm } from '../common/helpers/format-habitat-values.js'
import {
  HABITAT_UNITS_DELIVERED_LABEL,
  HEDGEROWS_TAB_ANCHOR,
  PI_DETAILS_HEADING
} from './constants.js'
import {
  buildSharedPiViewOnlyFields,
  EMPTY_PLACEHOLDER
} from './view-only-shared.js'

/**
 * Build the read-only view model for a retained post-intervention hedgerow
 * habitat. All values are display strings; habitat-details/pi-hedgerow-details.njk
 * renders them as a single stacked label-over-value section via
 * layouts/pi-view-only-sections-page.njk, with the parcel ref as the page
 * heading.
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
    heading: feature.ref ?? EMPTY_PLACEHOLDER,
    pageTitle: feature.ref ?? PI_DETAILS_HEADING,
    habitatDetailsSectionHeading: PI_DETAILS_HEADING,
    habitatUnitsLabel: HABITAT_UNITS_DELIVERED_LABEL,
    sizeDisplay: formatLengthKm(feature.sizeMetres),
    habitatTypeDisplay: proposed.type ?? ''
  }
}
