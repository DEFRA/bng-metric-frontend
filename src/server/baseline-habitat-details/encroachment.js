// Shared encroachment-filter logic for watercourse habitats. Imported by both
// the server strategy (strategies/watercourse.js) and the client dropdown
// script (client/javascripts/baseline-habitat-details.js) so the two sides
// cannot drift — the client bundle resolves this module through webpack, the
// server through Node ESM.
//
// The sentinel strings mirror the backend reference lookup tables
// `watercourse-types` and `watercourse-encroachments` (served from
// /reference/*). If those are renamed backend-side (e.g. 'Culvert' →
// 'Culvert (piped)'), this filter must be updated to match.
//
// Culverts carry a single "N/A - Culvert" encroachment value on both the
// watercourse and riparian dropdowns; every other watercourse habitat type
// excludes it and shows the graded options (BMD-597 AC set 1).
export const CULVERT_TYPE = 'Culvert'
export const CULVERT_ENCROACHMENT = 'N/A - Culvert'

export function encroachmentOptionsFor(watercourseType, allOptions) {
  if (watercourseType === CULVERT_TYPE) {
    return allOptions.filter((option) => option === CULVERT_ENCROACHMENT)
  }
  return allOptions.filter((option) => option !== CULVERT_ENCROACHMENT)
}
