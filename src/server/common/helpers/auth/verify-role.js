export const bngCompleterRole = 'bng completer'

// Defra Identity enrolment status that grants access. Only an APPROVED role
// lets a user use the service; a pending/rejected/removed "bng completer" role
// (status 1,2,4,5,6,7) is treated as unauthorised. Mirrors the backend RBAC,
// which makes a project visible only when the user's role for its relationship
// is status 3 (bng-metric-backend src/db/project-visibility.js).
export const ROLE_STATUS_APPROVED = 3

const ROLE_MIN_FIELDS = 3

/**
 * Parse a Defra ID role string "relationshipId:roleName:status". The role name
 * is rebuilt from the middle field(s) (so a stray colon can't shift the status),
 * lower-cased and trimmed; the status is coerced to a number.
 */
function parseRole(entry) {
  if (typeof entry !== 'string') {
    return null
  }
  const parts = entry.split(':')
  if (parts.length < ROLE_MIN_FIELDS) {
    return null
  }
  return {
    relationshipId: parts[0],
    name: parts
      .slice(1, parts.length - 1)
      .join(':')
      .trim()
      .toLowerCase(),
    status: Number(parts[parts.length - 1])
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

  const current = user?.currentRelationshipId
  if (!current) {
    return true
  }
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
