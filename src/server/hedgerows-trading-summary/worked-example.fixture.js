// Hedgerow trading-rules figures for the published worked example ("Hedgerow
// Trading Rules - Worked example"), at the full precision bng-library stores
// (rounded only for display). These are the figures bng-library's worked
// example test checks against the metric's Trading Summary Hedgerows sheet.

export const WORKED_EXAMPLE_TRADING_RULES = {
  habitatTypes: [
    {
      habitatType: 'Species-rich native hedgerow',
      distinctiveness: 'Medium',
      netUnitChange: -1.67698412156
    },
    {
      habitatType: 'Native hedgerow - associated with bank or ditch',
      distinctiveness: 'Medium',
      netUnitChange: 1.2914508193599996
    },
    {
      habitatType: 'Native hedgerow with trees',
      distinctiveness: 'Medium',
      netUnitChange: 0.8
    },
    {
      habitatType: 'Native hedgerow',
      distinctiveness: 'Low',
      netUnitChange: -1.9800000000000002
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
  medium: { netUnitChange: 0.41446669779999956 },
  low: {
    netUnitChange: -2.54716624548,
    cumulativeAvailability: -2.1326995476800006
  },
  veryLow: { netUnitChange: -0.35, cumulativeAvailability: -0.35 }
}
