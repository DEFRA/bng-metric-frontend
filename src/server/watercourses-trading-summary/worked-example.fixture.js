// Watercourse trading-rules figures for the published worked example, at the
// full precision bng-library stores (rounded only for display). Baseline and
// delivered units are the spreadsheet's C-1 / C-2 / C-3 totals.

export const WORKED_EXAMPLE_TRADING_RULES = {
  habitats: [
    {
      habitatType: 'Canals',
      distinctiveness: 'Medium',
      netUnitChange: -6.1809404754144
    },
    {
      habitatType: 'Culvert',
      distinctiveness: 'Low',
      netUnitChange: -21.488
    },
    {
      habitatType: 'Ditches',
      distinctiveness: 'Medium',
      netUnitChange: 12.9234128582792
    }
  ],
  medium: { surplus: 12.9234128582792, deficit: -6.1809404754144 },
  low: { netUnitChange: -21.488, cumulativeAvailability: -8.5645871417208 }
}
