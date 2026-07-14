import {
  formatHabitatUnits,
  formatLengthKm
} from '../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { HEDGEROWS_TAB_ANCHOR, PI_DETAILS_HEADING } from './constants.js'
import {
  DEFAULT_INTERVENTION,
  FIXED_STRATEGIC_SIGNIFICANCE,
  baselineDetailsHref,
  withMultiplier
} from './view-only-shared.js'

/**
 * Build the read-only view model for a retained post-intervention hedgerow
 * habitat (BMD-723). All values are display strings; the template renders them
 * as a govukSummaryList with no form controls. Relative to the baseline
 * hedgerow details page this adds an "Intervention" row and drops the
 * trading-rules row.
 *
 * Post-intervention values are read from `proposed`, mirroring the area page
 * (BMD-608) and the editable hedgerow page; for a retained hedgerow the
 * proposed side carries the same values as the baseline. Length and units come
 * from the top-level feature fields, matching how the backend stores them.
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
  const baseline = feature.baseline ?? {}
  return {
    pageTitle: `Biodiversity Net Gain - ${PI_DETAILS_HEADING}`,
    heading: PI_DETAILS_HEADING,
    caption: projectName,
    habitatRef: feature.ref ?? '',
    interventionDisplay: baseline.retentionCategory || DEFAULT_INTERVENTION,
    sizeDisplay: formatLengthKm(feature.sizeMetres),
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
    backHref: `/projects/${projectId}/post-intervention-habitat-list${HEDGEROWS_TAB_ANCHOR}`
  }
}
