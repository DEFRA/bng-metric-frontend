import { formatAreaHectaresValue } from '../common/helpers/format-habitat-values.js'
import {
  AREAS_TAB_ANCHOR,
  HABITAT_UNITS_DELIVERED_LABEL,
  PI_DETAILS_HEADING
} from './constants.js'
import {
  buildSharedPiViewOnlyFields,
  EMPTY_PLACEHOLDER
} from './view-only-shared.js'

/**
 * Build the read-only view model for a retained post-intervention area habitat.
 * All values are display strings; habitat-details/pi-habitat-details.njk
 * renders them as a single stacked label-over-value section (BMD-608 figma
 * design) via layouts/pi-view-only-sections-page.njk, with the parcel ref as
 * the page heading and no form controls.
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
    heading: feature.ref ?? EMPTY_PLACEHOLDER,
    pageTitle: feature.ref ?? PI_DETAILS_HEADING,
    habitatDetailsSectionHeading: PI_DETAILS_HEADING,
    habitatUnitsLabel: HABITAT_UNITS_DELIVERED_LABEL,
    sizeDisplay: formatAreaHectaresValue(feature.sizeSquareMetres),
    broadHabitatDisplay: proposed.broadType ?? EMPTY_PLACEHOLDER,
    habitatTypeDisplay: proposed.type ?? EMPTY_PLACEHOLDER
  }
}
