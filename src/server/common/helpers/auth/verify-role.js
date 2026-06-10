export const bngCompleterRole = 'bng completer'

/**
 * Parses the role name from a colon-delimited role string.
 * Live token format: "relationshipId:roleName:statusNum"
 * e.g. "23950a2d-...:Certifier:3" → "Certifier"
 */
function parseRoleName(roleEntry) {
  if (typeof roleEntry !== 'string') {
    return null
  }
  const parts = roleEntry.split(':')
  return parts.length >= 2 ? parts[1].trim().toLowerCase() : null
}

export function hasBngCompleterRole(user) {
  const roles = user?.roles
  if (!Array.isArray(roles)) {
    return false
  }

  return roles.some((entry) => parseRoleName(entry) === bngCompleterRole)
}

export const requireBngCompleterRole = {
  method(request, h) {
    const creds = request.auth.credentials

    if (hasBngCompleterRole(creds)) {
      request.logger.debug(
        { sub: creds?.sub },
        'Role check passed: user has the bng completer role'
      )
      return h.continue
    }

    request.logger.warn(
      {
        sub: creds?.sub,
        roles: creds?.roles,
        requiredRole: bngCompleterRole
      },
      'Role check failed: user lacks the bng completer role, redirecting to /auth/forbidden'
    )
    return h.redirect('/auth/forbidden').takeover()
  },
  assign: 'roleCheck'
}
