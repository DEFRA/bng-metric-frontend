import {
  hasBaselineData,
  hasHedgerows,
  hasWatercourses
} from './project-state.js'

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

describe('hasHedgerows', () => {
  test.each([
    [{ baseline: { hedgerows: [{}] } }, true],
    [{ postIntervention: { hedgerows: [{}] } }, true],
    [{ baseline: { hedgerows: [] } }, false],
    [{ baseline: {} }, false],
    [{}, false],
    [null, false]
  ])('identifies whether %j has hedgerows: %s', (project, expected) => {
    expect(hasHedgerows(project)).toBe(expected)
  })
})

describe('hasWatercourses', () => {
  test.each([
    [{ baseline: { watercourses: [{}] } }, true],
    [{ postIntervention: { watercourses: [{}] } }, true],
    [{ baseline: { watercourses: [] } }, false],
    [{ baseline: {} }, false],
    [{}, false],
    [null, false]
  ])('identifies whether %j has watercourses: %s', (project, expected) => {
    expect(hasWatercourses(project)).toBe(expected)
  })
})
