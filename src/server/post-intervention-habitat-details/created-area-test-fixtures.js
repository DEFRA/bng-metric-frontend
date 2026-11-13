export const creationReference = {
  featureType: 'habitat',
  hasBroadHabitat: true,
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

// BMD-1045: /reference/area-enhancement for a Grassland - Modified grassland
// baseline in Poor condition, cut down to two habitat types. Poor is not an
// enhancement of that baseline, and Urban is not offered at all.
export const enhancementReference = {
  featureType: 'habitat',
  hasBroadHabitat: true,
  habitatTypes: [
    {
      broad: 'Grassland',
      name: 'Modified grassland',
      distinctiveness: 'Low',
      distinctivenessScore: 2,
      difficulty: 'Low',
      difficultyMultiplier: 1,
      conditions: [
        { condition: 'Good', score: 3, years: 15 },
        { condition: 'Moderate', score: 2, years: 10 }
      ]
    },
    {
      broad: 'Grassland',
      name: 'Other neutral grassland',
      distinctiveness: 'Medium',
      distinctivenessScore: 4,
      difficulty: 'Medium',
      difficultyMultiplier: 0.67,
      conditions: [{ condition: 'Moderate', score: 2, years: 9 }]
    },
    {
      broad: 'Heathland and shrub',
      name: 'Mixed scrub',
      distinctiveness: 'Medium',
      distinctivenessScore: 4,
      difficulty: 'Low',
      difficultyMultiplier: 1,
      conditions: [{ condition: 'Good', score: 3, years: '30+' }]
    }
  ],
  strategicSignificance: creationReference.strategicSignificance,
  timeMultipliers: {
    ...creationReference.timeMultipliers,
    10: 0.7006,
    12: 0.6534,
    15: 0.5862
  }
}

export const enhancedAreaFeature = {
  featureId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ref: 'E-1',
  retentionCategory: 'Enhanced',
  sizeSquareMetres: 25000,
  units: 9.5,
  status: 'Complete',
  baseline: {
    broadType: 'Grassland',
    type: 'Modified grassland',
    condition: 'Poor'
  },
  proposed: {
    broadType: 'Grassland',
    type: 'Modified grassland',
    condition: 'Moderate',
    strategicSignificanceCategory: 'High',
    strategicSignificance: 'High',
    advanceYears: 0,
    delayYears: 2
  }
}
