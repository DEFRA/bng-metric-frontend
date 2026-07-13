// Shared building blocks for the read-only post-intervention habitat details
// view models (retained area — BMD-608, retained hedgerow — BMD-723). Both
// pages render the same govukSummaryList shell; only the size row and the
// broad-habitat row differ between feature types.

// Fixed for MVS, matching the baseline details pages (BMD-315 AC9 / BMD-500).
export const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'
// These pages are only reached for retained features, so fall back to this
// label when the feature carries no retention category (e.g. a baseline has
// not yet been uploaded).
export const DEFAULT_INTERVENTION = 'Retained'
export const PI_DETAILS_HEADING = 'Post-intervention habitat details'

/**
 * Render a value with its multiplier in brackets ("Low (2)"), or just the value
 * when the score is absent, or an empty cell when there is no value.
 *
 * @param {string|null|undefined} value
 * @param {number|null|undefined} score
 * @returns {string}
 */
export function withMultiplier(value, score) {
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
export function baselineDetailsHref(baselineFeatureId, projectId) {
  if (!baselineFeatureId) {
    return null
  }
  const params = new URLSearchParams({
    featureId: baselineFeatureId,
    projectId
  })
  return `/baseline-habitat-details?${params.toString()}`
}
