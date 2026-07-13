import {
  formatAreaHectares,
  formatHabitatUnits
} from '../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { AREAS_TAB_ANCHOR, PI_DETAILS_HEADING } from './constants.js'

// Fixed for MVS, matching the baseline area details page (BMD-315 AC9).
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'
// BMD-608 is the "Retained" variant; the page is only reached for retained
// area habitats, so fall back to this label when the feature carries no
// retention category (e.g. a baseline has not yet been uploaded).
const DEFAULT_INTERVENTION = 'Retained'

/**
 * Render a value with its multiplier in brackets ("Low (2)"), or just the value
 * when the score is absent, or an empty cell when there is no value.
 *
 * @param {string|null|undefined} value
 * @param {number|null|undefined} score
 * @returns {string}
 */
function withMultiplier(value, score) {
  if (!value) {
    return ''
  }
  if (typeof score === 'number') {
    return `${value} (${score})`
  }
  return value
}

// Baseline and post-intervention are separate uploads, so a parcel gets a
// different featureId in each document; the baseline feature is resolved by
// ref by the caller and passed in here. Null means no matching baseline
// feature (e.g. no baseline uploaded), in which case the link is hidden.
function baselineDetailsHref(baselineFeatureId, projectId) {
  if (!baselineFeatureId) {
    return null
  }
  const params = new URLSearchParams({
    featureId: baselineFeatureId,
    projectId
  })
  return `/baseline-habitat-details?${params.toString()}`
}

/**
 * Build the read-only view model for a retained post-intervention area habitat
 * (BMD-608). All values are display strings; the template renders them as a
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
