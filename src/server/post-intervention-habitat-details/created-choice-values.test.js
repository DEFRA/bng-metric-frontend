import { supportedCreatedValues } from './created-choice-values.js'

// The PO's ruling (BMD-1046 testing): a stored choice its list does not offer
// is not shown or kept, so it reads as blank.

const reference = {
  habitatTypes: [
    {
      broad: 'Grassland',
      name: 'Modified grassland',
      conditions: [{ condition: 'Moderate' }, { condition: 'Good' }]
    },
    {
      broad: 'Heathland and shrub',
      name: 'Mixed scrub',
      conditions: [{ condition: 'Good' }]
    }
  ],
  strategicSignificance: [{ value: 'Low' }, { value: 'High' }],
  watercourseEncroachment: ['No Encroachment', 'Minor'],
  riparianEncroachment: ['No Encroachment/No Encroachment']
}

const areaKind = { hasBroadHabitat: true }
const linearKind = { hasBroadHabitat: false }
const watercourseKind = { hasBroadHabitat: false, hasEncroachments: true }

const supported = {
  ref: 'P-1',
  broadHabitat: 'Grassland',
  habitatType: 'Modified grassland',
  condition: 'Good',
  strategicSignificance: 'High',
  advanceYears: '30+',
  delayYears: '0'
}

describe('supportedCreatedValues', () => {
  test('keeps supported values untouched, returning a copy', () => {
    const values = { ...supported }
    const result = supportedCreatedValues(values, reference, areaKind)
    expect(result).toEqual(supported)
    expect(result).not.toBe(values)
  })

  test('clears an out-of-list broad habitat and the type and condition under it', () => {
    const values = { ...supported, broadHabitat: 'Urban' }
    const snapshot = { ...values }
    expect(supportedCreatedValues(values, reference, areaKind)).toEqual({
      ...supported,
      broadHabitat: '',
      habitatType: '',
      condition: ''
    })
    expect(values).toEqual(snapshot)
  })

  test('clears a type not listed under its broad habitat, and its condition', () => {
    expect(
      supportedCreatedValues(
        { ...supported, habitatType: 'Mixed scrub' },
        reference,
        areaKind
      )
    ).toMatchObject({
      broadHabitat: 'Grassland',
      habitatType: '',
      condition: ''
    })
  })

  test('clears a condition its habitat type does not offer', () => {
    expect(
      supportedCreatedValues(
        { ...supported, condition: 'Poor' },
        reference,
        areaKind
      )
    ).toMatchObject({ habitatType: 'Modified grassland', condition: '' })
  })

  test('reads a kind with no broad habitat against every habitat type', () => {
    const { broadHabitat: _none, ...linear } = supported
    expect(
      supportedCreatedValues(
        { ...linear, habitatType: 'Mixed scrub', condition: 'Good' },
        reference,
        linearKind
      )
    ).toMatchObject({ habitatType: 'Mixed scrub', condition: 'Good' })
  })

  test.each([
    ['strategicSignificance', 'Medium'],
    ['strategicSignificance', 'Location ecologically desirable'],
    ['advanceYears', '2.5'],
    ['delayYears', '31']
  ])('clears an unsupported %s of %s', (field, value) => {
    const result = supportedCreatedValues(
      { ...supported, [field]: value },
      reference,
      areaKind
    )
    expect(result).toEqual({ ...supported, [field]: '' })
  })

  test('clears unsupported encroachments only for a kind that has them', () => {
    const values = {
      ...supported,
      watercourseEncroachment: 'Major',
      riparianEncroachment: 'No Encroachment/No Encroachment'
    }
    expect(
      supportedCreatedValues(values, reference, watercourseKind)
    ).toMatchObject({
      watercourseEncroachment: '',
      riparianEncroachment: 'No Encroachment/No Encroachment'
    })
    expect(
      supportedCreatedValues(values, reference, areaKind)
        .watercourseEncroachment
    ).toBe('Major')
  })

  test('leaves blank values blank', () => {
    const blank = Object.fromEntries(
      Object.keys(supported).map((field) => [field, ''])
    )
    expect(supportedCreatedValues(blank, reference, areaKind)).toEqual(blank)
  })
})
