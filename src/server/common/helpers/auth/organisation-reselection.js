function toArray(value) {
  if (Array.isArray(value)) {
    return value
  }
  return typeof value === 'string' && value.length > 0 ? [value] : []
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function claimId(entry) {
  return typeof entry === 'string' ? entry.split(':')[0] : null
}

function countRelationshipsWithoutRoles(relationships, roles) {
  const roleRelationshipIds = new Set(roles.map(claimId).filter(Boolean))
  return relationships.filter((relationship) => {
    const relationshipId = claimId(relationship)
    return relationshipId && !roleRelationshipIds.has(relationshipId)
  }).length
}

export function canSelectDifferentOrganisation(user) {
  const relationships = toArray(user?.relationships)
  const roles = toArray(user?.roles)

  if (relationships.length > 1) {
    return true
  }

  if (toNumber(user?.enrolmentCount) > roles.length) {
    return true
  }

  const relationshipsWithoutRoles = countRelationshipsWithoutRoles(
    relationships,
    roles
  )

  return toNumber(user?.enrolmentRequestCount) > relationshipsWithoutRoles
}
