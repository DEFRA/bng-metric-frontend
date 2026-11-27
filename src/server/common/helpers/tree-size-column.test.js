import { describe, expect, test } from 'vitest'

import { buildHabitatGrid } from './habitat-grid.js'
import { TREE_SIZE_COLUMN, TREE_SIZE_HEADER } from './tree-size-column.js'

const REF_COLUMN = { text: 'Ref', cell: (feature) => ({ text: feature.ref }) }

function grid(features) {
  return buildHabitatGrid({
    columns: [REF_COLUMN, TREE_SIZE_COLUMN],
    features,
    projectId: 'project-1',
    readSize: () => null
  })
}

describe('TREE_SIZE_COLUMN', () => {
  test('shows a baseline tree’s size class, ranked for sorting', () => {
    const { columns, habitatRows } = grid([
      { ref: 'T1', treeSize: 'Very large' }
    ])

    expect(columns.map((column) => column.text)).toEqual([
      'Ref',
      TREE_SIZE_HEADER
    ])
    expect(habitatRows[0][1]).toEqual({
      text: 'Very large',
      attributes: { 'data-sort-value': 3 }
    })
  })

  test('reads a post-intervention tree’s proposed size before its baseline side', () => {
    const { habitatRows } = grid([
      {
        ref: 'T5',
        baseline: { treeSize: 'N/A' },
        proposed: { treeSize: ' Small ', broadType: 'Individual trees' }
      }
    ])

    expect(habitatRows[0][1]).toEqual({
      text: 'Small',
      attributes: { 'data-sort-value': 0 }
    })
  })

  test('leaves the cell blank for an area habitat on a table with a tree', () => {
    const { habitatRows } = grid([
      { ref: 'P1', broadType: 'Grassland' },
      { ref: 'T1', treeSize: 'Medium' }
    ])

    expect(habitatRows[0][1]).toEqual({ text: '' })
  })

  test('shows the column for a tree without a size class, with no sort rank', () => {
    const { columns, habitatRows } = grid([
      { ref: 'T1', broadType: 'Individual trees', treeSize: null }
    ])

    expect(columns).toHaveLength(2)
    expect(habitatRows[0][1]).toEqual({ text: '' })
  })

  test('leaves the column out of a table with no trees', () => {
    const { columns, habitatRows, totalsRow } = grid([
      { ref: 'P1', broadType: 'Grassland' }
    ])

    expect(columns.map((column) => column.text)).toEqual(['Ref'])
    expect(habitatRows[0]).toHaveLength(1)
    expect(totalsRow).toHaveLength(1)
  })
})
