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
