export const creationReference = {
  habitatTypes: [
    {
      broad: 'Grassland',
      name: 'Modified grassland',
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
      broad: 'Urban',
      name: 'Developed land; sealed surface',
      distinctiveness: 'Very low',
      distinctivenessScore: 0,
      difficulty: 'Low',
      difficultyMultiplier: 1,
      conditions: [{ condition: 'N/A - Other', score: 0, years: 0 }]
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
    9: 0.7256811131,
    '30+': 0.3197967361
  }
}

export const createdAreaFeature = {
  featureId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ref: 'P-1',
  retentionCategory: 'Created',
  sizeSquareMetres: 25000,
  units: 11.68,
  proposed: {
    broadType: 'Grassland',
    type: 'Modified grassland',
    condition: 'Good',
    strategicSignificanceCategory: 'Low',
    advanceYears: 0,
    delayYears: 0
  }
}
