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

// A Medium urban tree in Moderate condition, kept and enhanced to Good,
// standing for 2 trees.
export const enhancedTree = {
  featureId,
  ref: 'T006',
  retentionCategory: 'Enhanced',
  count: 2,
  sizeSquareMetres: 326,
  units: 0.2,
  status: 'Complete',
  baseline: {
    broadType: 'Individual trees',
    type: 'Urban tree',
    treeSize: 'Medium',
    condition: 'Moderate'
  },
  proposed: {
    broadType: 'Individual trees',
    type: 'Urban tree',
    treeSize: 'Medium',
    condition: 'Good',
    strategicSignificance: 'Low',
    strategicSignificanceCategory: 'Low',
    advanceYears: 0,
    delayYears: 0
  }
}

const enhancements = {
  Good: [],
  'Fairly Good': [{ condition: 'Good', score: 3, years: 8 }],
  Moderate: [
    { condition: 'Good', score: 3, years: 16 },
    { condition: 'Fairly Good', score: 2.5, years: 8 }
  ],
  Poor: [
    { condition: 'Good', score: 3, years: '30+' },
    { condition: 'Moderate', score: 2, years: 16 }
  ]
}

export const treeEnhancementReference = {
  habitatTypes: ['Rural tree', 'Urban tree'].map((name) => ({
    name,
    broad: 'Individual trees',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    difficulty: 'Low',
    difficultyMultiplier: 1,
    enhancements
  })),
  strategicSignificance: [
    { value: 'High', score: 1.15 },
    { value: 'Low', score: 1 }
  ],
  timeMultipliers: { 0: 1, 8: 0.75, 16: 0.565 }
}
