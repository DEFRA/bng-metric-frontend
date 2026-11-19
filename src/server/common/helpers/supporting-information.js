// A habitat's supporting information (its comment) shown read-only: on a
// Retained habitat's post-intervention page (BMD-1187) and on a baseline
// habitat's page once post-intervention data is uploaded (BMD-1194).

// Shown in place of the comment when none is saved.
export const NO_SUPPORTING_INFORMATION = 'No data'

/**
 * The comment as saved, line breaks included, or "No data" when there is none.
 * The backend stores a blank comment as null; blank or whitespace-only text is
 * treated the same, in case an older document holds it.
 *
 * @param {unknown} comment
 * @returns {string}
 */
export function supportingInformationDisplay(comment) {
  if (typeof comment === 'string' && comment.trim() !== '') {
    return comment
  }
  return NO_SUPPORTING_INFORMATION
}
