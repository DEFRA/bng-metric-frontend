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
    request.logger.debug(
      { roles: creds?.roles },
      'Role check: inspecting credentials'
    )

    if (hasBngCompleterRole(creds)) {
      return h.continue
    }
    return h.redirect('/auth/forbidden').takeover()
  },
  assign: 'roleCheck'
}
