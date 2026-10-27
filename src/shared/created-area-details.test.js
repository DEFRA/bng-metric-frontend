import { createdAreaDerived } from './created-area-details.js'
import { creationReference } from '../server/post-intervention-habitat-details/created-area-test-fixtures.js'

const values = {
  broadHabitat: 'Grassland',
  habitatType: 'Modified grassland',
  condition: 'Good',
  advanceYears: '0',
  delayYears: '0'
}

describe('Created area derived fields', () => {
  test.each([
    [{ advanceYears: '', delayYears: '0' }, ''],
    [{ advanceYears: '0', delayYears: '' }, ''],
    [{ advanceYears: '2', delayYears: '3' }, ''],
    [{ advanceYears: '0', delayYears: '30+' }, '30+ years (0.3197967361)'],
    [{ advanceYears: '30+', delayYears: '0' }, '0 years (1)']
  ])('calculates timing for %j', (timing, expected) => {
    expect(
      createdAreaDerived(creationReference, { ...values, ...timing })
        .finalTimeToTargetDisplay
    ).toBe(expected)
  })

  test('30+ statutory time keeps the overflow bucket until there is an advance', () => {
    const reference = structuredClone(creationReference)
    reference.habitatTypes[0].conditions[0].years = '30+'
    reference.timeMultipliers['29'] = 0.3558705807
    expect(createdAreaDerived(reference, values).finalTimeToTargetDisplay).toBe(
      '30+ years (0.3197967361)'
    )
    expect(
      createdAreaDerived(reference, { ...values, advanceYears: '1' })
        .finalTimeToTargetDisplay
    ).toBe('29 years (0.3558705807)')
  })

  test.each([
    ['Poor', 'Poor to Good - 7 years'],
    ['N/A', 'Good - 7 years'],
    ['N/A - Other', 'Good - 7 years'],
    ['', 'Good - 7 years']
  ])('retains the baseline wording for %s', (baseline, expected) => {
    expect(
      createdAreaDerived(creationReference, values, baseline)
        .standardTimeToTargetDisplay
    ).toBe(expected)
  })

  test('cleared habitat type clears every derived value', () => {
    const result = createdAreaDerived(creationReference, {
      ...values,
      habitatType: ''
    })
    expect(Object.values(result)).toEqual(['', '', '', '', ''])
  })
})
