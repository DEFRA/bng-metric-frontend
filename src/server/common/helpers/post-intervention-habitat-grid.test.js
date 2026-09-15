import {
  buildPostInterventionHabitatGrid,
  formatYears,
  habitatTabHeading
} from './post-intervention-habitat-grid.js'
import {
  formatLengthKmDisplay,
  formatTotalLengthSize
} from './format-habitat-values.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

function buildGrid(interventionType, features) {
  return buildPostInterventionHabitatGrid({
    features,
    projectId: PROJECT_ID,
    interventionType,
    readSize: (feature) => feature.sizeMetres,
    formatSize: formatLengthKmDisplay,
    formatSizeTotal: formatTotalLengthSize
  })
}

describe('habitatTabHeading', () => {
  test('names the selected intervention type and habitat noun', () => {
    expect(habitatTabHeading('Created', 'hedgerow')).toBe(
      'Created hedgerow habitats'
    )
    expect(habitatTabHeading('Retained', 'hedgerow')).toBe(
      'Retained hedgerow habitats'
    )
    expect(habitatTabHeading('Enhanced', 'hedgerow')).toBe(
      'Enhanced hedgerow habitats'
    )
  })
})

describe('formatYears', () => {
  test('uses singular year for 1 and plural otherwise', () => {
    expect(formatYears(1)).toBe('1 year')
    expect(formatYears('1')).toBe('1 year')
    expect(formatYears(10)).toBe('10 years')
    expect(formatYears(0)).toBe('0 years')
    expect(formatYears(null)).toBe('')
  })
})

describe('buildPostInterventionHabitatGrid', () => {
  test('builds retained columns including condition and a PI details link', () => {
    const grid = buildGrid('Retained', [
      {
        featureId: 'hedge-1',
        ref: 'P-A1',
        units: 0.8,
        sizeMetres: 1234567.891,
        proposed: {
          type: 'Native hedgerow',
          distinctiveness: 'Medium',
          distinctivenessScore: 4,
          condition: 'Fairly Poor',
          conditionScore: 1
        }
      }
    ])

    expect(grid.columns.map((column) => column.text)).toEqual([
      'Ref',
      'Units',
      'Size',
      'Habitat type',
      'Distinctiveness',
      'Condition',
      'Strategic significance'
    ])
    expect(grid.habitatRows[0][0].href).toBe(
      `/post-intervention-habitat-details?featureId=hedge-1&projectId=${PROJECT_ID}`
    )
    expect(grid.habitatRows[0][1].text).toBe('0.80')
    expect(grid.habitatRows[0][2].text).toBe('1234.568km')
    expect(grid.habitatRows[0][3].text).toBe('Native hedgerow')
    expect(grid.habitatRows[0][4].text).toBe('Medium (4)')
    expect(grid.habitatRows[0][5].text).toBe('Fairly Poor (1)')
    expect(grid.habitatRows[0][6].text).toBe('Low (1)')
    expect(grid.totalsRow[0].text).toBe('Total')
    expect(grid.totalsRow[1].text).toBe('0.80')
    expect(grid.totalsRow[2].text).toBe('1234.568km')
    expect(grid.totalsRow).toHaveLength(grid.columns.length)
  })

  test('builds enhanced and created columns with target, time and difficulty', () => {
    const feature = {
      featureId: 'hedge-2',
      ref: 'P-A2',
      units: 1.5,
      sizeMetres: 2000,
      proposed: {
        type: 'Species-rich native hedgerow',
        distinctiveness: 'High',
        distinctivenessScore: 6,
        condition: 'Good',
        conditionScore: 3,
        standardTimeToTargetCondition: '1',
        advanceYears: 10,
        delayYears: 0,
        finalTimeToTargetCondition: '10 years (0.5555)',
        difficulty: 'Low',
        difficultyMultiplier: 1
      }
    }

    const enhanced = buildGrid('Enhanced', [feature])
    const created = buildGrid('Created', [feature])

    expect(enhanced.columns.map((column) => column.text)).toEqual([
      'Ref',
      'Units',
      'Size',
      'Habitat type',
      'Distinctiveness',
      'Strategic significance',
      'Target condition',
      'Standard time to target',
      'Advance',
      'Delay',
      'Final time to target',
      'Standard difficulty'
    ])
    expect(created.columns.map((column) => column.text)).toEqual(
      enhanced.columns.map((column) => column.text)
    )
    expect(enhanced.columns.some((column) => column.text === 'Condition')).toBe(
      false
    )
    expect(enhanced.habitatRows[0][6].text).toBe('Good (3)')
    expect(enhanced.habitatRows[0][7].text).toBe('1 year')
    expect(enhanced.habitatRows[0][8].text).toBe('10 years')
    expect(enhanced.habitatRows[0][9].text).toBe('0 years')
    expect(enhanced.habitatRows[0][10].text).toBe('10 years (0.5555)')
    expect(enhanced.habitatRows[0][11].text).toBe('Low (1)')
  })

  test('sums units and size for the current intervention type', () => {
    const grid = buildGrid('Created', [
      { units: 0.1, sizeMetres: 1000, proposed: {} },
      { units: 0.02, sizeMetres: 500, proposed: {} }
    ])

    expect(grid.totalsRow[1].text).toBe('0.12')
    expect(grid.totalsRow[2].text).toBe('1.5km')
  })
})
