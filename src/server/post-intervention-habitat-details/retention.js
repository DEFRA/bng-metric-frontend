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

/**
 * The display string for the "Intervention" row.
 *
 * @param {unknown} rawCategory
 * @returns {string}
 */
export function interventionDisplay(rawCategory) {
  return normaliseRetentionCategory(rawCategory) ?? DEFAULT_INTERVENTION
}
