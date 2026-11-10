import { visibleInterventionTabs } from './intervention-tabs.js'

describe('visibleInterventionTabs', () => {
  test('returns only categories that have at least one habitat, in display order', () => {
    expect(
      visibleInterventionTabs([
        { retentionCategory: 'Created' },
        { retentionCategory: '1. Enhanced' }
      ]).map((tab) => tab.id)
    ).toEqual(['enhanced', 'created'])
  })

  test('treats a missing retention category as Retained', () => {
    expect(
      visibleInterventionTabs([{}, { retentionCategory: '' }]).map(
        (tab) => tab.id
      )
    ).toEqual(['retained'])
  })

  test('does not place an unrecognised category onto any tab', () => {
    expect(visibleInterventionTabs([{ retentionCategory: 'Lost' }])).toEqual([])
  })

  test.each(['Retained', 'Enhanced', 'Created'])(
    'uses the legacy baseline category for %s rows',
    (category) => {
      expect(
        visibleInterventionTabs([
          { baseline: { retentionCategory: ` 2. ${category} ` } }
        ]).map((tab) => tab.label)
      ).toEqual([category])
    }
  )

  test('keeps the root category authoritative over a legacy baseline category', () => {
    expect(
      visibleInterventionTabs([
        {
          retentionCategory: 'Retained',
          baseline: { retentionCategory: 'Created' }
        },
        {
          retentionCategory: 'Lost',
          baseline: { retentionCategory: 'Created' }
        }
      ]).map((tab) => tab.id)
    ).toEqual(['retained'])
  })
})
