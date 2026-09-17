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
})
