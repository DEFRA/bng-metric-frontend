// The single definition of when two Defra Identity relationship ids mean the
// same relationship.
//
// Relationship ids are GUIDs, and GUIDs are case-insensitive (RFC 4122) — a
// provider may emit either case. Defra ID does exactly that: the id_token from a
// refresh_token grant carries the same currentRelationshipId as the sign-in
// token in a DIFFERENT CASE, confirmed by the drift classifier in
// refresh-session.js reporting `differs:case-only`. Any comparison that does not
// fold case will therefore reject a perfectly valid org context.
//
// That was the whole of BMD-936: hasBngCompleterRole compared verbatim, so one
// case flip failed the role check ~20 minutes into a session and signed the user
// out. The same class of bug reaches every other site that compares these ids —
// the org-switch check (which would wipe an in-flight upload journey by reading a
// case flip as a genuine switch), the current-relationship resolver behind the
// organisation shown in the header, and the reselection check.
//
// Kept in its own module so all of them share one definition, and so it mirrors
// canonicalRelationshipId in bng-metric-backend
// (src/services/defra-id/claims.js): the frontend forwards the RAW token, so
// both ends have to agree on what counts as the same relationship.

/**
 * Fold a relationship id to its canonical comparable form, or null when there
 * isn't one. RFC 4122 defines lower-case as the output form, so this is the
 * canonical spelling rather than an arbitrary choice.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function canonicalRelationshipId(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  return value.trim().toLowerCase()
}

/**
 * Whether two relationship ids denote the same relationship. Two absent ids are
 * NOT the same relationship — callers that need "both missing" handled make that
 * decision explicitly.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function isSameRelationship(a, b) {
  const left = canonicalRelationshipId(a)
  return left !== null && left === canonicalRelationshipId(b)
}
