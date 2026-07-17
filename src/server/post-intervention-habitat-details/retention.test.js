import { describe, it, expect } from 'vitest'

import { interventionDisplay, normaliseRetentionCategory } from './retention.js'

describe('normaliseRetentionCategory', () => {
  it.each([
    ['Retained', 'Retained'],
    // The backend never writes its normalised value back, so the raw GeoPackage
    // value can still carry the "N. " list prefix.
    ['1. Retained', 'Retained'],
    ['2.Created', 'Created'],
    ['  Enhanced  ', 'Enhanced']
  ])('normalises %j to %j', (raw, expected) => {
    expect(normaliseRetentionCategory(raw)).toBe(expected)
  })

  it.each([[null], [undefined], [''], ['   '], [42]])(
    'returns null for %j',
    (raw) => {
      expect(normaliseRetentionCategory(raw)).toBeNull()
    }
  )
})

describe('interventionDisplay', () => {
  it('strips the list prefix from the raw category', () => {
    expect(interventionDisplay('1. Retained')).toBe('Retained')
  })

  it('defaults to Retained when the feature carries no category', () => {
    expect(interventionDisplay(undefined)).toBe('Retained')
  })
})
