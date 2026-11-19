export const watercourseCreationReference = {
  featureType: 'watercourse',
  hasBroadHabitat: false,
  habitatTypes: [
    {
      name: 'Canals',
      distinctiveness: 'Medium',
      distinctivenessScore: 4,
      difficulty: 'Medium',
      difficultyMultiplier: 0.67,
      conditions: [
        {
          condition: 'Good',
          score: 3,
          years: 10
        },
        {
          condition: 'Fairly Good',
          score: 2.5,
          years: 8
        },
        {
          condition: 'Moderate',
          score: 2,
          years: 5
        },
        {
          condition: 'Fairly Poor',
          score: 1.5,
          years: 2
        },
        {
          condition: 'Poor',
          score: 1,
          years: 1
        }
      ]
    },
    {
      name: 'Culvert',
      distinctiveness: 'Low',
      distinctivenessScore: 2,
      difficulty: 'Medium',
      difficultyMultiplier: 0.67,
      conditions: [
        {
          condition: 'Poor',
          score: 1,
          years: 1
        }
      ]
    },
    {
      name: 'Ditches',
      distinctiveness: 'Medium',
      distinctivenessScore: 4,
      difficulty: 'Medium',
      difficultyMultiplier: 0.67,
      conditions: [
        {
          condition: 'Good',
          score: 3,
          years: 10
        },
        {
          condition: 'Fairly Good',
          score: 2.5,
          years: 8
        },
        {
          condition: 'Moderate',
          score: 2,
          years: 5
        },
        {
          condition: 'Fairly Poor',
          score: 1.5,
          years: 2
        },
        {
          condition: 'Poor',
          score: 1,
          years: 1
        }
      ]
    }
  ],
  strategicSignificance: [
    {
      value: 'High',
      score: 1.15
    },
    {
      value: 'Low',
      score: 1
    }
  ],
  timeMultipliers: {
    0: 1,
    1: 0.965,
    2: 0.931225,
    3: 0.898632125,
    4: 0.8671800006,
    5: 0.8368287006,
    6: 0.8075396961,
    7: 0.7792758067,
    8: 0.7520011535,
    9: 0.7256811131,
    10: 0.7002822742,
    11: 0.6757723946,
    12: 0.6521203607,
    13: 0.6292961481,
    14: 0.6072707829,
    15: 0.5860163055,
    16: 0.5655057348,
    17: 0.5457130341,
    18: 0.5266130779,
    19: 0.5081816202,
    20: 0.4903952635,
    21: 0.4732314293,
    22: 0.4566683292,
    23: 0.4406849377,
    24: 0.4252609649,
    25: 0.4103768311,
    26: 0.396013642,
    27: 0.3821531646,
    28: 0.3687778038,
    29: 0.3558705807,
    30: 0.3434151104,
    '>30': 0.3197967361,
    '30+': 0.3197967361
  },
  watercourseEncroachment: [
    'No Encroachment',
    'Minor',
    'Major',
    'N/A - Culvert'
  ],
  riparianEncroachment: [
    'Major/Major',
    'Major/Moderate',
    'Major/Minor',
    'Major/No Encroachment',
    'Moderate/Moderate',
    'Moderate/Minor',
    'Moderate/No Encroachment',
    'Minor/Minor',
    'Minor/No Encroachment',
    'No Encroachment/No Encroachment',
    'N/A - Culvert'
  ]
}

export const createdWatercourseFeature = {
  featureId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ref: 'W-1',
  retentionCategory: '2. Created',
  sizeMetres: 500,
  units: 2.24,
  baseline: {
    condition: 'Moderate'
  },
  proposed: {
    type: 'Ditches',
    condition: 'Moderate',
    strategicSignificance: 'Low',
    strategicSignificanceCategory: 'Low',
    advanceYears: 0,
    delayYears: 0,
    watercourseEncroachment: 'Minor',
    riparianEncroachment: 'Minor/No Encroachment',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    difficulty: 'Medium',
    difficultyMultiplier: 0.67,
    standardTimeToTargetCondition: '5',
    finalTimeToTargetCondition: '5 years (0.8368287006)'
  }
}

// BMD-1047: the backend's watercourse enhancement reference for a Culvert in
// Poor condition, which may move to any Medium distinctiveness watercourse at
// a fixed 10 years (BMD-820 AC10). Culvert itself is never offered.
const UPLIFT_CONDITIONS = [
  { condition: 'Good', score: 3, years: 10 },
  { condition: 'Fairly Good', score: 2.5, years: 10 },
  { condition: 'Moderate', score: 2, years: 10 },
  { condition: 'Fairly Poor', score: 1.5, years: 10 },
  { condition: 'Poor', score: 1, years: 10 }
]

export const watercourseEnhancementReference = {
  ...watercourseCreationReference,
  habitatTypes: ['Canals', 'Ditches'].map((name) => ({
    name,
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    difficulty: 'Low',
    difficultyMultiplier: 1,
    conditions: UPLIFT_CONDITIONS
  }))
}

export const enhancedWatercourseFeature = {
  featureId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ref: 'WC-E',
  retentionCategory: 'Enhanced',
  sizeMetres: 1250,
  units: 3.1,
  status: 'Complete',
  baseline: { type: 'Culvert', condition: 'Poor' },
  proposed: {
    type: 'Ditches',
    condition: 'Moderate',
    strategicSignificance: 'Low',
    strategicSignificanceCategory: 'Low',
    advanceYears: 0,
    delayYears: 0,
    watercourseEncroachment: 'Minor',
    riparianEncroachment: 'Minor/No Encroachment',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    difficulty: 'Low',
    difficultyMultiplier: 1,
    standardTimeToTargetCondition: '10',
    finalTimeToTargetCondition: '10 years (0.7002822742)'
  }
}
