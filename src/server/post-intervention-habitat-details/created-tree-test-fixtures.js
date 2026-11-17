import { featureId } from './controller-test-helpers.js'

// A Created individual tree is edited as a Created area habitat is, but stays
// a tree.

// A Medium urban tree newly planted, standing for 2 trees.
export const createdTree = {
  featureId,
  ref: 'T026',
  retentionCategory: 'Created',
  count: 2,
  sizeSquareMetres: 326,
  units: 0.2,
  status: 'Complete',
  baseline: {},
  proposed: {
    broadType: 'Individual trees',
    type: 'Urban tree',
    treeSize: 'Medium',
    condition: 'Poor',
    strategicSignificance: 'Low',
    strategicSignificanceCategory: 'Low',
    advanceYears: 0,
    delayYears: 0
  }
}

export const treeCreationReference = {
  habitatTypes: ['Rural tree', 'Urban tree'].map((name) => ({
    name,
    broad: 'Individual trees',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    difficulty: 'Low',
    difficultyMultiplier: 1,
    conditions: [
      { condition: 'Moderate', score: 2, years: 27 },
      { condition: 'Poor', score: 1, years: 10 }
    ]
  })),
  strategicSignificance: [
    { value: 'High', score: 1.15 },
    { value: 'Low', score: 1 }
  ],
  timeMultipliers: { 0: 1, 10: 0.7, 27: 0.382 }
}
