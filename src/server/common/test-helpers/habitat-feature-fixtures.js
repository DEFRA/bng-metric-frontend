export const PI_FEATURE = {
  featureId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ref: 'H1-1',
  area: 7850,
  sizeSquareMetres: 7850.14,
  units: 3.14,
  status: 'Complete',
  baseline: {
    type: 'Modified grassland',
    broadType: 'Grassland',
    condition: 'Moderate',
    conditionScore: 2,
    distinctiveness: 'Low',
    distinctivenessScore: 2,
    strategicSignificance: 'Low',
    retentionCategory: 'Lost'
  },
  proposed: {
    type: 'Developed land; sealed surface',
    broadType: 'Urban',
    condition: 'N/A - Other',
    conditionScore: null,
    distinctiveness: 'Low',
    distinctivenessScore: 2,
    strategicSignificance: 'Low',
    advanceYears: 0,
    delayYears: 0
  },
  properties: {}
}

export const PI_TREE_FEATURE = {
  featureId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  ref: 'T1',
  area: 163,
  sizeSquareMetres: 163,
  units: 0.2,
  status: 'Complete',
  count: 1,
  baseline: {
    type: 'Urban tree',
    broadType: 'Individual trees',
    condition: 'Good',
    conditionScore: 3,
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    treeSize: 'Small',
    ruralOrUrban: 'Urban',
    sizeSquareMetres: 41,
    area: 41
  },
  proposed: {
    type: 'Urban tree',
    broadType: 'Individual trees',
    condition: 'Good',
    conditionScore: 3,
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    treeSize: 'Medium',
    ruralOrUrban: 'Urban',
    sizeSquareMetres: 163,
    area: 163,
    advanceYears: 0,
    delayYears: 0
  },
  properties: {}
}

export const BASELINE_FEATURE = {
  featureId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  ref: 'P1',
  type: 'Lowland meadows',
  broadType: 'Grassland',
  condition: 'Good',
  conditionScore: 3,
  distinctiveness: 'V.High',
  distinctivenessScore: 8,
  units: 24,
  status: 'Complete',
  properties: {}
}
