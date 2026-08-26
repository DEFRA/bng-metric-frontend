import { describe, expect, test } from 'vitest'

import { parseRelationships, currentRelationship } from './relationship.js'

const REL_A = 'rel-1'
const REL_B = 'rel-2'

// relationshipId:organisationId:organisationName:organisationLoa:relationship:relationshipLoa
const relString = (relId, orgId, orgName, rel = 'Employee') =>
  `${relId}:${orgId}:${orgName}:0:${rel}:1`

describe('#parseRelationships', () => {
  test('parses an employee relationship with an org', () => {
    const user = { relationships: [relString(REL_A, 'org-1', 'Acme Ltd')] }
    expect(parseRelationships(user)).toEqual([
      {
        relationshipId: REL_A,
        orgId: 'org-1',
        orgName: 'Acme Ltd',
        relationship: 'Employee'
      }
    ])
  })

  test('normalises a citizen (no org) to null org id/name', () => {
    const user = { relationships: [`${REL_A}:::0:Citizen:0`] }
    expect(parseRelationships(user)).toEqual([
      {
        relationshipId: REL_A,
        orgId: null,
        orgName: null,
        relationship: 'Citizen'
      }
    ])
  })

  test('reconstructs an organisation name that contains colons', () => {
    const user = {
      relationships: [`${REL_A}:org-1:Acme: Holdings: Ltd:0:Agent:1`]
    }
    expect(parseRelationships(user)[0]).toEqual({
      relationshipId: REL_A,
      orgId: 'org-1',
      orgName: 'Acme: Holdings: Ltd',
      relationship: 'Agent'
    })
  })

  test('accepts a bare string and drops malformed / absent claims', () => {
    expect(
      parseRelationships({ relationships: relString(REL_A, 'o', 'n') })
    ).toHaveLength(1)
    expect(parseRelationships({ relationships: ['too:few'] })).toEqual([])
    expect(parseRelationships({})).toEqual([])
    expect(parseRelationships(null)).toEqual([])
  })
})

describe('#currentRelationship', () => {
  test('returns the relationship matching currentRelationshipId', () => {
    const user = {
      currentRelationshipId: REL_B,
      relationships: [
        relString(REL_A, 'org-1', 'Acme Ltd'),
        relString(REL_B, 'org-2', 'Globex', 'Agent')
      ]
    }
    expect(currentRelationship(user)).toEqual({
      relationshipId: REL_B,
      orgId: 'org-2',
      orgName: 'Globex',
      relationship: 'Agent'
    })
  })

  test('picks the active org for an agent holding several relationships', () => {
    const user = {
      currentRelationshipId: REL_A,
      relationships: [
        relString(REL_A, 'org-1', 'First Org', 'Agent'),
        relString(REL_B, 'org-2', 'Second Org', 'Agent')
      ]
    }
    expect(currentRelationship(user).orgName).toBe('First Org')
  })

  test('returns a citizen current relationship with a null org', () => {
    const user = {
      currentRelationshipId: REL_A,
      relationships: [`${REL_A}:::0:Citizen:0`]
    }
    expect(currentRelationship(user)).toMatchObject({
      relationshipId: REL_A,
      orgName: null,
      relationship: 'Citizen'
    })
  })

  test('returns null when currentRelationshipId is absent', () => {
    const user = { relationships: [relString(REL_A, 'org-1', 'Acme Ltd')] }
    expect(currentRelationship(user)).toBeNull()
  })

  test('returns null when currentRelationshipId has no matching relationship', () => {
    const user = {
      currentRelationshipId: 'rel-unknown',
      relationships: [relString(REL_A, 'org-1', 'Acme Ltd')]
    }
    expect(currentRelationship(user)).toBeNull()
  })

  test('returns null for a missing / null user', () => {
    expect(currentRelationship(null)).toBeNull()
    expect(currentRelationship({})).toBeNull()
  })
})

describe('currentRelationship case-insensitivity (BMD-936)', () => {
  // A refreshed token spells currentRelationshipId differently from the sign-in
  // token; failing to match drops the organisation from the shared header.
  const REL = '2819c414-5349-f111-bec6-000d3a495d27'
  const entry = `${REL}:org-1:Acme Ltd:0:Employee:1`

  test('resolves the relationship when the current id is cased differently', () => {
    const result = currentRelationship({
      currentRelationshipId: REL.toUpperCase(),
      relationships: [entry]
    })

    expect(result).toMatchObject({ orgId: 'org-1', orgName: 'Acme Ltd' })
  })

  test('resolves when the relationships entry is the one cased differently', () => {
    const result = currentRelationship({
      currentRelationshipId: REL,
      relationships: [entry.toUpperCase()]
    })

    expect(result).not.toBeNull()
  })

  test('still returns null for a relationship the user does not hold', () => {
    const result = currentRelationship({
      currentRelationshipId: 'eb18c414-5349-f111-bec6-000d3a495d27',
      relationships: [entry]
    })

    expect(result).toBeNull()
  })
})
