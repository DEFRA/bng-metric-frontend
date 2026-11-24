import { describe, expect, it } from 'vitest'

import { treeDetailsFields } from './tree-details.js'

describe('treeDetailsFields', () => {
  it('shows the size class, and no number of trees', () => {
    expect(treeDetailsFields('Very large')).toEqual({
      treeSizeDisplay: 'Very large'
    })
  })

  it.each([null, '', '  '])(
    'shows nothing for a size class of %j',
    (treeSize) => {
      expect(treeDetailsFields(treeSize).treeSizeDisplay).toBe('')
    }
  )
})
