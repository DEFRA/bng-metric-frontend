import { hasBaselineData, hasHabitatData } from './project-state.js'

describe('hasBaselineData', () => {
  test.each([
    [{ baseline: {} }, true],
    [{ baseline: {}, postIntervention: {} }, true],
    [{}, false],
    [null, false]
  ])('identifies whether %j has baseline data: %s', (project, expected) => {
    expect(hasBaselineData(project)).toBe(expected)
  })
})

describe('hasHabitatData', () => {
  test.each([
    [{ baseline: { hedgerows: [{}] } }, 'hedgerows', true],
    [{ postIntervention: { hedgerows: [{}] } }, 'hedgerows', true],
    [
      {
        baseline: { watercourses: [] },
        postIntervention: { watercourses: [{}] }
      },
      'watercourses',
      true
    ],
    [
      {
        baseline: { hedgerows: [] },
        postIntervention: { hedgerows: [] }
      },
      'hedgerows',
      false
    ],
    [{ baseline: {} }, 'watercourses', false],
    [null, 'hedgerows', false]
  ])(
    'identifies whether %j has uploaded %s data: %s',
    (project, habitatType, expected) => {
      expect(hasHabitatData(project, habitatType)).toBe(expected)
    }
  )
})
