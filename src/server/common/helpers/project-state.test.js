import { hasBaselineData } from './project-state.js'

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
