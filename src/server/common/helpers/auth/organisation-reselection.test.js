import { canSelectDifferentOrganisation } from './organisation-reselection.js'

describe('#canSelectDifferentOrganisation', () => {
  test('returns true when the user has more than one relationship', () => {
    expect(
      canSelectDifferentOrganisation({
        relationships: [
          'rel-1:org-1:Org One:0:Employee:1',
          'rel-2:::0:Citizen:0'
        ],
        roles: ['rel-1:bng completer:3']
      })
    ).toBe(true)
  })

  test('returns true when enrolmentCount exceeds the number of roles', () => {
    expect(
      canSelectDifferentOrganisation({
        relationships: ['rel-1:org-1:Org One:0:Employee:1'],
        roles: ['rel-1:bng completer:3'],
        enrolmentCount: 2
      })
    ).toBe(true)
  })

  test('returns true when enrolmentRequestCount exceeds relationships without matching roles', () => {
    expect(
      canSelectDifferentOrganisation({
        relationships: ['rel-1:org-1:Org One:0:Employee:1'],
        roles: ['rel-1:bng completer:3'],
        enrolmentRequestCount: 1
      })
    ).toBe(true)
  })

  test('returns false when no reselection signal is present', () => {
    expect(
      canSelectDifferentOrganisation({
        relationships: ['rel-1:org-1:Org One:0:Employee:1'],
        roles: ['rel-1:bng completer:3'],
        enrolmentCount: 1,
        enrolmentRequestCount: 0
      })
    ).toBe(false)
  })

  test('does not offer reselection when enrolment requests are covered by relationships without roles', () => {
    expect(
      canSelectDifferentOrganisation({
        relationships: ['rel-1:org-1:Org One:0:Employee:1'],
        roles: [],
        enrolmentRequestCount: 1
      })
    ).toBe(false)
  })

  test('handles missing claims without offering reselection', () => {
    expect(canSelectDifferentOrganisation(null)).toBe(false)
    expect(canSelectDifferentOrganisation({})).toBe(false)
  })
})

describe('relationship/role pairing is case-insensitive (BMD-936)', () => {
  const REL = '2819c414-5349-f111-bec6-000d3a495d27'

  test('pairs a relationship with its role when the two claims disagree on case', () => {
    // One relationship, and it HAS a role — so there is no second org to select.
    // Without case folding the role would not pair up, the relationship would
    // count as role-less, and the "choose a different organisation" affordance
    // would be offered to a user who has nowhere else to go.
    const result = canSelectDifferentOrganisation({
      relationships: [`${REL}:org-1:Acme Ltd:0:Employee:1`],
      roles: [`${REL.toUpperCase()}:bng completer:3`],
      enrolmentCount: 1
    })

    expect(result).toBe(false)
  })
})
