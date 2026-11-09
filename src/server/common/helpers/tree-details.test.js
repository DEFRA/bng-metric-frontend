import { describe, expect, it } from 'vitest'

import { treeDetailsFields } from './tree-details.js'

describe('treeDetailsFields', () => {
  it('shows the size class and the number of trees', () => {
    expect(treeDetailsFields('Very large', 3)).toEqual({
      treeSizeDisplay: 'Very large',
      treeCountDisplay: '3'
    })
  })

  it.each([null, undefined, 0, 2.5, '3'])(
    'counts a point whose Count is %j as one tree',
    (count) => {
      expect(treeDetailsFields('Small', count).treeCountDisplay).toBe('1')
    }
  )

  it.each([null, '', '  '])(
    'shows nothing for a size class of %j',
    (treeSize) => {
      expect(treeDetailsFields(treeSize, 1).treeSizeDisplay).toBe('')
    }
  )
})
