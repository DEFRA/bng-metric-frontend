import {
  BROAD_HABITAT_COLUMN,
  BROAD_HABITAT_HEADER,
  buildBaselineHabitatGrid,
  sortBaselineFeatures
} from './baseline-habitat-grid.js'
import {
  formatBaselineTotalLengthSize,
  formatLengthKmDisplay
} from './format-habitat-values.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

describe('sortBaselineFeatures', () => {
  test('orders features by ref, using featureId when ref is blank', () => {
    const sorted = sortBaselineFeatures([
      { ref: 'H-10', featureId: 'c' },
      { ref: 'H-2', featureId: 'b' },
      { ref: 'H-1', featureId: 'a' }
    ])

    expect(sorted.map((feature) => feature.featureId)).toEqual(['a', 'b', 'c'])
  })
})

describe('buildBaselineHabitatGrid', () => {
  test('pads ref sort keys so double-figure refs stay in server order', () => {
    const features = sortBaselineFeatures([
      { featureId: 'a', ref: 'H-10' },
      { featureId: 'b', ref: 'H-2' },
      { featureId: 'c', ref: 'H-11' },
      { featureId: 'd', ref: 'H-1' }
    ])
    const grid = buildBaselineHabitatGrid({
      features,
      projectId: PROJECT_ID,
      readSize: (feature) => feature.sizeMetres,
      formatSize: formatLengthKmDisplay,
      formatSizeTotal: formatBaselineTotalLengthSize
    })

    const rendered = grid.habitatRows.map((row) => ({
      ref: row[0].text,
      sortValue: row[0].attributes['data-sort-value']
    }))
    const clientSorted = [...rendered].sort((left, right) =>
      left.sortValue.localeCompare(right.sortValue)
    )

    expect(clientSorted.map(({ ref }) => ref)).toEqual(
      rendered.map(({ ref }) => ref)
    )
  })

  test('builds aligned columns with formatted size, units and a Low (1) default', () => {
    const grid = buildBaselineHabitatGrid({
      features: [
        {
          featureId: 'hedge-1',
          ref: 'H-1',
          type: 'Native hedgerow',
          units: 0.8,
          sizeMetres: 1234567.891,
          distinctiveness: 'Low',
          distinctivenessScore: 2,
          condition: 'Good',
          conditionScore: 3
        }
      ],
      projectId: PROJECT_ID,
      readSize: (feature) => feature.sizeMetres,
      formatSize: formatLengthKmDisplay,
      formatSizeTotal: formatBaselineTotalLengthSize
    })

    expect(grid.columns).toHaveLength(7)
    expect(
      grid.columns.some((column) => column.text === BROAD_HABITAT_HEADER)
    ).toBe(false)
    expect(grid.habitatRows).toHaveLength(1)
    expect(grid.habitatRows[0][0].href).toBe(
      `/baseline-habitat-details?featureId=hedge-1&projectId=${PROJECT_ID}`
    )
    expect(grid.habitatRows[0][1].text).toBe('0.80')
    expect(grid.habitatRows[0][2].text).toBe('1234.568km')
    expect(grid.habitatRows[0][2].attributes['data-sort-value']).toBe(
      1234567.891
    )
    expect(grid.habitatRows[0][6].text).toBe('Low (1)')
    expect(grid.totalsRow[0].text).toBe('Total')
    expect(grid.totalsRow[1].text).toBe('0.80')
    expect(grid.totalsRow[2].text).toBe('1234.567891km')
    expect(grid.totalsRow).toHaveLength(grid.columns.length)
  })

  test('includes Broad habitat when the extra column is supplied', () => {
    const grid = buildBaselineHabitatGrid({
      features: [{ ref: 'P-1', broadType: 'Grassland', type: 'Meadow' }],
      projectId: PROJECT_ID,
      readSize: () => 100,
      formatSize: () => '1ha',
      formatSizeTotal: () => '1ha',
      extraColumns: [BROAD_HABITAT_COLUMN]
    })

    expect(grid.columns).toHaveLength(8)
    expect(grid.columns.map((column) => column.text)).toContain(
      BROAD_HABITAT_HEADER
    )
    expect(grid.habitatRows[0][3].text).toBe('Grassland')
  })

  test('returns an empty body with the same column count when there are no features', () => {
    const grid = buildBaselineHabitatGrid({
      features: [],
      projectId: PROJECT_ID,
      readSize: (feature) => feature.sizeMetres,
      formatSize: formatLengthKmDisplay,
      formatSizeTotal: formatBaselineTotalLengthSize
    })

    expect(grid.habitatRows).toEqual([])
    expect(grid.columns).toHaveLength(7)
    expect(grid.totalsRow).toHaveLength(7)
    expect(grid.totalsRow[1].text).toBe('0.00')
    expect(grid.totalsRow[2].text).toBe('0km')
  })
})
