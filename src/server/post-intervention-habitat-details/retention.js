// Retention category ("Intervention") handling for post-intervention features.
//
// The backend normalises the raw GeoPackage value when it decides which engine
// calculation to run, but it never writes the normalised value back — the
// project document keeps whatever the upload carried. So the frontend can be
// handed "Retained", "1. Retained" or "  Retained  " for the same feature and
// must normalise before comparing or displaying.

export const RETENTION_RETAINED = 'Retained'
export const RETENTION_ENHANCED = 'Enhanced'
export const RETENTION_CREATED = 'Created'

// Only reached for features with no retention category at all (e.g. a baseline
// has not been uploaded yet), which the view-only pages treat as retained.
export const DEFAULT_INTERVENTION = RETENTION_RETAINED

/**
 * Strip a leading "N. " list prefix and surrounding whitespace from a raw
 * retention category ("1. Retained" -> "Retained"), mirroring the backend's
 * `normaliseRetentionCategory`. Returns null when there is no usable value.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function normaliseRetentionCategory(value) {
  if (typeof value !== 'string') {
    return null
  }
  const normalised = value.trim().replace(/^\d+\.\s*/u, '')
  return normalised || null
}

const RETENTION_CATEGORIES = [
  RETENTION_RETAINED,
  RETENTION_ENHANCED,
  RETENTION_CREATED
]

/**
 * A feature's retention category, normalised. Read from the feature root, or
 * for a project imported before the field moved there, from
 * `baseline.retentionCategory` when that is Retained, Enhanced or Created, as
 * the backend's `resolveRetentionCategory` reads it. Null when neither holds
 * one.
 *
 * @param {{ retentionCategory?: unknown, baseline?: { retentionCategory?: unknown } }} feature
 * @returns {string|null}
 */
export function featureRetentionCategory(feature) {
  const root = normaliseRetentionCategory(feature?.retentionCategory)
  if (root) {
    return root
  }
  const nested = normaliseRetentionCategory(
    feature?.baseline?.retentionCategory
  )
  return RETENTION_CATEGORIES.includes(nested) ? nested : null
}

/**
 * The display string for the "Intervention" row.
 *
 * @param {unknown} rawCategory
 * @returns {string}
 */
export function interventionDisplay(rawCategory) {
  return normaliseRetentionCategory(rawCategory) ?? DEFAULT_INTERVENTION
}
