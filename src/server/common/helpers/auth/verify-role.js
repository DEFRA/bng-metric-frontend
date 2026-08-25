export const bngCompleterRole = 'bng completer'

// Defra Identity enrolment status that grants access. Only an APPROVED role
// lets a user use the service; a pending/rejected/removed "bng completer" role
// (status 1,2,4,5,6,7) is treated as unauthorised. Mirrors the backend RBAC,
// which makes a project visible only when the user's role for its relationship
// is status 3 (bng-metric-backend src/db/project-visibility.js).
export const ROLE_STATUS_APPROVED = 3

const ROLE_MIN_FIELDS = 3

// Valid enrolment status codes span 1–7. A non-numeric or out-of-range status is
// dropped rather than coerced to NaN. Mirrors the backend parser
// (bng-metric-backend src/services/defra-id/claims.js); the CDP Defra ID stub's
// registration UI emits word labels ("complete", "pending", …) not codes.
const ROLE_STATUS_MIN = 1
const ROLE_STATUS_MAX = 7

// Coerce the trailing status field to a number, but only when it is a clean
// integer in the valid 1–7 range; otherwise return null so the role is dropped.
function parseStatus(raw) {
  if (!/^\d+$/.test(raw)) {
    return null
  }
  const status = Number(raw)
  if (status < ROLE_STATUS_MIN || status > ROLE_STATUS_MAX) {
    return null
  }
  return status
}

/**
 * Fold a relationship id to its canonical comparable form (lower-case, trimmed),
 * or null when there isn't one. Mirrors canonicalRelationshipId in the backend
 * (src/services/defra-id/claims.js) — both sides of the forwarded token have to
 * agree on what counts as the same relationship.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
function canonicalRelationshipId(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  return value.trim().toLowerCase()
}

/**
 * Parse a Defra ID role string "relationshipId:roleName:status". The role name
 * is rebuilt from the middle field(s) (so a stray colon can't shift the status),
 * lower-cased and trimmed; the status is coerced to a number. Roles whose status
 * is not a valid 1–7 code are dropped (returns null).
 */
function parseRole(entry) {
  if (typeof entry !== 'string') {
    return null
  }
  const parts = entry.split(':')
  if (parts.length < ROLE_MIN_FIELDS) {
    return null
  }
  const status = parseStatus(parts[parts.length - 1])
  if (status === null) {
    return null
  }
  return {
    // Case-folded like the name: relationship ids are GUIDs, and GUIDs are
    // case-insensitive (RFC 4122). Defra ID emits the SAME currentRelationshipId
    // in a different case on a refresh_token grant than on interactive sign-in —
    // confirmed by the drift classifier in refresh-session.js
    // (`differs:case-only`) — so a verbatim comparison rejected a valid org
    // context and ended the session. That was the whole of BMD-936.
    relationshipId: canonicalRelationshipId(parts[0]),
    name: parts
      .slice(1, parts.length - 1)
      .join(':')
      .trim()
      .toLowerCase(),
    status
  }
}

/**
 * Whether the user may use the service. They must hold an APPROVED (status 3)
 * "bng completer" role. When the token carries a `currentRelationshipId` (the
 * org context the user is acting in), the approved role must be for that
 * relationship — matching the backend, which scopes visibility per relationship.
 * Without a current relationship, any approved "bng completer" role suffices.
 *
 * @param {object} user the verified token claims (request.auth.credentials)
 */
export function hasBngCompleterRole(user) {
  const roles = user?.roles
  if (!Array.isArray(roles)) {
    return false
  }

  const approvedCompleterRels = roles
    .map(parseRole)
    .filter(
      (role) =>
        role?.name === bngCompleterRole && role.status === ROLE_STATUS_APPROVED
    )
    .map((role) => role.relationshipId)

  if (approvedCompleterRels.length === 0) {
    return false
  }

  const current = canonicalRelationshipId(user?.currentRelationshipId)
  if (!current) {
    return true
  }
  // Both sides are canonicalised, so the same relationship in a different case
  // still matches.
  return approvedCompleterRels.includes(current)
}

export const requireBngCompleterRole = {
  method(request, h) {
    const creds = request.auth.credentials

    if (hasBngCompleterRole(creds)) {
      request.logger.debug(
        { sub: creds?.sub },
        'Role check passed: user has an approved bng completer role'
      )
      return h.continue
    }

    request.logger.warn(
      {
        sub: creds?.sub,
        roles: creds?.roles,
        currentRelationshipId: creds?.currentRelationshipId,
        requiredRole: bngCompleterRole,
        requiredStatus: ROLE_STATUS_APPROVED
      },
      'Role check failed: user lacks an approved bng completer role, redirecting to /auth/forbidden'
    )
    return h.redirect('/auth/forbidden').takeover()
  },
  assign: 'roleCheck'
}
