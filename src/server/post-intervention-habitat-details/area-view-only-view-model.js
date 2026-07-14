import {
  formatAreaHectares,
  formatHabitatUnits
} from '../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { AREAS_TAB_ANCHOR, PI_DETAILS_HEADING } from './constants.js'
import {
  DEFAULT_INTERVENTION,
  FIXED_STRATEGIC_SIGNIFICANCE,
  baselineDetailsHref,
  withMultiplier
} from './view-only-shared.js'

/**
 * Build the read-only view model for a retained post-intervention area habitat.
 * All values are display strings; the template renders them as a
 * govukSummaryList with no form controls.
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
  const baseline = feature.baseline ?? {}
  return {
    pageTitle: `Biodiversity Net Gain - ${PI_DETAILS_HEADING}`,
    heading: PI_DETAILS_HEADING,
    caption: projectName,
    habitatRef: feature.ref ?? '',
    interventionDisplay: baseline.retentionCategory || DEFAULT_INTERVENTION,
    sizeDisplay: formatAreaHectares(feature.sizeSquareMetres),
    broadHabitatDisplay: proposed.broadType ?? '',
    habitatTypeDisplay: proposed.type ?? '',
    distinctivenessDisplay: withMultiplier(
      proposed.distinctiveness,
      proposed.distinctivenessScore
    ),
    conditionDisplay: withMultiplier(
      stripConditionPrefix(proposed.condition),
      proposed.conditionScore
    ),
    strategicSignificanceDisplay: FIXED_STRATEGIC_SIGNIFICANCE,
    habitatUnitsDisplay: formatHabitatUnits(feature.units),
    viewBaselineHref: baselineDetailsHref(baselineFeatureId, projectId),
    backHref: `/projects/${projectId}/post-intervention-habitat-list${AREAS_TAB_ANCHOR}`
  }
}
