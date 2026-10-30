export const hedgerowCreationReference = {
  featureType: 'hedgerow',
  habitatTypes: [
    {
      name: 'Native hedgerow',
      distinctiveness: 'Low',
      distinctivenessScore: 2,
      difficulty: 'Low',
      difficultyMultiplier: 1,
      conditions: [
        { condition: 'Good', score: 3, years: 7 },
        { condition: 'Poor', score: 1, years: 1 }
      ]
    },
    {
      name: 'Native hedgerow with trees',
      distinctiveness: 'Medium',
      distinctivenessScore: 4,
      difficulty: 'Low',
      difficultyMultiplier: 1,
      conditions: [{ condition: 'Good', score: 3, years: 10 }]
    }
  ],
  strategicSignificance: [
    { value: 'Low', score: 1 },
    { value: 'High', score: 1.15 }
  ],
  timeMultipliers: {
    0: 1,
    1: 0.965,
    5: 0.8368287006,
    7: 0.7792758067,
    10: 0.7,
    '30+': 0.3197967361
  }
}
export const createdHedgerowFeature = {
  featureId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ref: 'H-1',
  retentionCategory: '2. Created',
  sizeMetres: 336,
  units: 1.57,
  proposed: {
    type: 'Native hedgerow',
    condition: 'Good',
    strategicSignificanceCategory: 'Low',
    advanceYears: 0,
    delayYears: 0
  }
}
