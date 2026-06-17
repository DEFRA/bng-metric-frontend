// Pure parsers for the colon-delimited `relationships` claim carried in a Defra
// ID (Customer Identity) token, plus a resolver for the user's CURRENT org
// context. No I/O, no logging — safe to call from the verified-token path and
// trivially unit-testable. Mirrors the backend parser
// (bng-metric-backend src/services/defra-id/claims.js) so what the home page
// shows matches what the backend persisted from the same token.
//
// relationship string shape:
//   relationshipId:organisationId:organisationName:organisationLoa:relationship:relationshipLoa
//
// Organisation names can themselves contain ':' (e.g. "Acme: Holdings Ltd"), so
// the parser pins the fixed leading/trailing fields positionally and rebuilds
// the name from everything in between. Citizens have no organisation — their org
// id/name fields are empty ("relId:::0:Citizen:0"), normalised to null here.

// Fixed fields at the front (relationshipId, organisationId) and back
// (organisationLoa, relationship, relationshipLoa) of a relationship string.
const RELATIONSHIP_LEADING_FIELDS = 2
const RELATIONSHIP_TRAILING_FIELDS = 3
const RELATIONSHIP_MIN_FIELDS =
  RELATIONSHIP_LEADING_FIELDS + RELATIONSHIP_TRAILING_FIELDS + 1

function toEntries(value) {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === 'string' && value.length > 0) {
    return [value]
  }
  return []
}

function parseRelationship(entry) {
  if (typeof entry !== 'string') {
    return null
  }
  const parts = entry.split(':')
  if (parts.length < RELATIONSHIP_MIN_FIELDS) {
    return null
  }
  const nameParts = parts.slice(
    RELATIONSHIP_LEADING_FIELDS,
    parts.length - RELATIONSHIP_TRAILING_FIELDS
  )
  return {
    relationshipId: parts[0],
    // Empty org fields (citizens) become null, not '', so the view can hide them.
    orgId: parts[1] || null,
    orgName: nameParts.join(':') || null,
    // The `relationship` descriptor (Citizen | Employee | Agent) sits
    // second-from-last (before relationshipLoa).
    relationship: parts[parts.length - 2] || null
  }
}

/**
 * Parse the `relationships` claim into structured objects.
 * @param {object} user the verified token claims (request.auth.credentials / session user)
 * @returns {Array<{relationshipId: string, orgId: string|null, orgName: string|null, relationship: string|null}>}
 */
export function parseRelationships(user) {
  return toEntries(user?.relationships)
    .map(parseRelationship)
    .filter((rel) => rel !== null)
}

/**
 * Resolve the user's CURRENT relationship — the org context they are acting in —
 * by matching the token's `currentRelationshipId` against the parsed
 * relationships. A user (an Agent in particular) can hold relationships across
 * several orgs; this returns the active one. Returns null when there is no
 * current relationship id or it does not appear among the relationships.
 *
 * @param {object} user the verified token claims
 * @returns {{relationshipId: string, orgId: string|null, orgName: string|null, relationship: string|null}|null}
 */
export function currentRelationship(user) {
  const currentId = user?.currentRelationshipId
  if (!currentId) {
    return null
  }
  return (
    parseRelationships(user).find((rel) => rel.relationshipId === currentId) ??
    null
  )
}
