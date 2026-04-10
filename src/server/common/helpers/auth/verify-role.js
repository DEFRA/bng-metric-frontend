export const bngCompleterRole = 'bng completer'

export function hasBngCompleterRole(user) {
  const relationships = user?.relationships
  if (!Array.isArray(relationships)) {
    return false
  }

  return relationships.some(
    (relationship) =>
      typeof relationship?.roleName === 'string' &&
      relationship.roleName.trim().toLowerCase() === bngCompleterRole
  )
}

export const requireBngCompleterRole = {
  method(request, h) {
    if (hasBngCompleterRole(request.auth.credentials)) {
      return h.continue
    }
    return h.redirect('/auth/forbidden').takeover()
  },
  assign: 'roleCheck'
}
