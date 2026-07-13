import {
  formatHabitatUnits,
  formatLengthKm
} from '../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import {
  FIXED_STRATEGIC_SIGNIFICANCE,
  DEFAULT_INTERVENTION,
  PI_DETAILS_HEADING,
  withMultiplier,
  baselineDetailsHref
} from './view-only-shared.js'

const HEDGEROWS_TAB_ANCHOR = '#hedgerows'
const HEDGEROW_SIZE_LABEL = 'Length (km)'

/**
 * Build the read-only view model for a retained post-intervention hedgerow
 * habitat (BMD-723). Mirrors the area view-only page (BMD-608) but measures
 * length in km, has no broad-habitat dimension, and drops the trading-rules
 * row (trading rules do not apply post-intervention).
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
    sizeLabel: HEDGEROW_SIZE_LABEL,
    sizeDisplay: formatLengthKm(feature.sizeMetres),
    showBroadHabitatRow: false,
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
