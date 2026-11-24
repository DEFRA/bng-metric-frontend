import { describe, expect, it } from 'vitest'

import { treeDetailsFields } from './tree-details.js'

describe('treeDetailsFields', () => {
  it('shows a legacy tree its size class and the number of trees', () => {
    expect(treeDetailsFields('Very large', 3, false)).toEqual({
      treeSizeDisplay: 'Very large',
      treeCountDisplay: '3',
      showTreeCountRow: true
    })
  })

  it('shows a BNG Service template tree no number of trees', () => {
    expect(treeDetailsFields('Very large', undefined, true)).toEqual({
      treeSizeDisplay: 'Very large',
      treeCountDisplay: '1',
      showTreeCountRow: false
    })
  })

  it.each([null, undefined, 0, 2.5, '3'])(
    'counts a point whose Count is %j as one tree',
    (count) => {
      expect(treeDetailsFields('Small', count, false).treeCountDisplay).toBe(
        '1'
      )
    }
  )

  it.each([null, '', '  '])(
    'shows nothing for a size class of %j',
    (treeSize) => {
      expect(treeDetailsFields(treeSize, 1, false).treeSizeDisplay).toBe('')
    }
  )
})
