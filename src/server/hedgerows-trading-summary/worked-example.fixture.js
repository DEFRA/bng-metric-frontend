// Hedgerow trading-rules figures for the worked example, recalculated with
// every baseline hedgerow at strategic significance Low (1) as the service
// forces ("Example - Hedgerows MVS (SS=1).xlsx" on BMD-1028). The published
// Confluence worked example uses 1.1 for three baselines, so its figures can't
// come out of the service. Values are the metric's Trading Summary Hedgerows
// sheet at full precision (rounded only for display).

export const WORKED_EXAMPLE_TRADING_RULES = {
  habitatTypes: [
    {
      habitatType: 'Species-rich native hedgerow',
      distinctiveness: 'Medium',
      netUnitChange: -1.47698412156
    },
    {
      habitatType: 'Native hedgerow - associated with bank or ditch',
      distinctiveness: 'Medium',
      netUnitChange: 1.4914508193599998
    },
    {
      habitatType: 'Native hedgerow with trees',
      distinctiveness: 'Medium',
      netUnitChange: 0.8
    },
    {
      habitatType: 'Native hedgerow',
      distinctiveness: 'Low',
      netUnitChange: -1.8
    },
    {
      habitatType: 'Line of trees',
      distinctiveness: 'Low',
      netUnitChange: 0.16415073244
    },
    {
      habitatType: 'Line of trees - associated with bank or ditch',
      distinctiveness: 'Low',
      netUnitChange: -0.7313169779199999
    },
    {
      habitatType: 'Non-native and ornamental hedgerow',
      distinctiveness: 'V.Low',
      netUnitChange: -0.35
    }
  ],
  medium: { netUnitChange: 0.8144666977999999 },
  low: {
    netUnitChange: -2.36716624548,
    cumulativeAvailability: -1.55269954768
  },
  veryLow: { netUnitChange: -0.35, cumulativeAvailability: -0.35 }
}
