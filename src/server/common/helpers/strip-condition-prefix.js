// QGIS / statutory tool condition labels are often prefixed with an index
// (e.g. "6. N/A - Other"). The backend's reference data uses the suffix only
// ("N/A - Other"), so saved condition values must have the prefix stripped
// before they can be matched against dropdown options. The backend now
// normalises on ingest, but legacy baselines that pre-date that change still
// carry the prefix — this defensive strip keeps pre-selection working.

/**
 * @param {unknown} condition
 * @returns {string | unknown}
 */
export function stripConditionPrefix(condition) {
  if (typeof condition !== 'string') {
    return condition
  }
  return condition.trim().replace(/^\d+\.\s+/u, '')
}
