// Shared building blocks for the read-only post-intervention details pages
// (BMD-608 areas, BMD-723 hedgerows). Keeping them here means the view-only
// variants render the same fixed values and "View baseline details" link the
// same way.

// Strategic significance is fixed at Low (1) in MVS across every habitat type,
// matching the baseline details pages (BMD-315 AC9). The variable significance
// multipliers come later.
export const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'

// The view-only pages are only reached for retained features, so fall back to
// this label when a feature carries no retention category (e.g. a baseline has
// not yet been uploaded).
export const DEFAULT_INTERVENTION = 'Retained'

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

/**
 * Build the "View baseline details" href for a post-intervention feature.
 * Baseline and post-intervention are separate uploads, so a parcel gets a
 * different featureId in each document; the baseline feature is resolved by ref
 * by the caller and passed in here. Null means no matching baseline feature
 * (e.g. no baseline uploaded), in which case the link is hidden.
 *
 * @param {string|null} baselineFeatureId
 * @param {string} projectId
 * @returns {string|null}
 */
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
