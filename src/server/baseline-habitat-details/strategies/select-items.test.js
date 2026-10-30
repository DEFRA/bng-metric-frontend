import { buildConditionItems, buildSelectItems } from './select-items.js'

describe('buildSelectItems', () => {
  test('lists the options with the saved one selected', () => {
    expect(buildSelectItems(['A', 'B'], 'B', 'Choose')).toEqual([
      { value: '', text: 'Choose', selected: false },
      { value: 'A', text: 'A', selected: false },
      { value: 'B', text: 'B', selected: true }
    ])
  })

  test('selects the blank choice when nothing is saved', () => {
    expect(buildSelectItems(['A'], null, 'Choose')[0].selected).toBe(true)
  })

  test('keeps a saved value the options no longer hold, selected', () => {
    expect(buildSelectItems(['A'], 'Retired type', 'Choose')).toEqual([
      { value: '', text: 'Choose', selected: false },
      { value: 'A', text: 'A', selected: false },
      { value: 'Retired type', text: 'Retired type', selected: true }
    ])
  })
})

describe('buildConditionItems', () => {
  const conditions = [
    { condition: 'Good', score: 3 },
    { condition: 'Poor', score: 1 }
  ]

  test('lists each condition with its score, the saved one selected', () => {
    expect(buildConditionItems(conditions, 'Poor')).toEqual([
      { value: '', text: 'Choose condition', selected: false },
      { value: 'Good', text: 'Good (3)', selected: false },
      { value: 'Poor', text: 'Poor (1)', selected: true }
    ])
  })

  test('keeps a saved condition the list no longer holds, selected', () => {
    expect(buildConditionItems(conditions, 'Fairly Poor').at(-1)).toEqual({
      value: 'Fairly Poor',
      text: 'Fairly Poor',
      selected: true
    })
  })

  test('selects the blank choice when nothing is saved', () => {
    expect(buildConditionItems([], undefined)).toEqual([
      { value: '', text: 'Choose condition', selected: true }
    ])
  })
})
