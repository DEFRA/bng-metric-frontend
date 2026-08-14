import { isBaselineOnlyProject } from './project-state.js'

describe('isBaselineOnlyProject', () => {
  test.each([
    [{ baseline: {} }, true],
    [{ baseline: {}, postIntervention: {} }, false],
    [{}, false],
    [null, false]
  ])('identifies %j as baseline-only: %s', (project, expected) => {
    expect(isBaselineOnlyProject(project)).toBe(expected)
  })
})
