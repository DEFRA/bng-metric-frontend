// Area-habitat trading-rules figures for the published worked example
// ("Area Habitat Trading Rules - Worked example"), exactly as the backend saves
// them: bng-library's calculator run over the example's baseline and delivered
// units. The page is validated against the figures the example publishes.
export const WORKED_EXAMPLE_TRADING_RULES = {
  habitatTypes: [
    {
      habitatType: 'Grassland - Other lowland acid grassland',
      broadHabitat: 'Grassland',
      tradingBroadHabitat: 'Grassland',
      distinctiveness: 'Medium',
      netUnitChange: 108.288166104
    },
    {
      habitatType: 'Grassland - Other neutral grassland',
      broadHabitat: 'Grassland',
      tradingBroadHabitat: 'Grassland',
      distinctiveness: 'Medium',
      netUnitChange: 6.18689120268
    },
    {
      habitatType: 'Grassland - Upland acid grassland',
      broadHabitat: 'Grassland',
      tradingBroadHabitat: 'Grassland',
      distinctiveness: 'Medium',
      netUnitChange: 5.09344560134
    },
    {
      habitatType: 'Heathland and shrub - Blackthorn scrub',
      broadHabitat: 'Heathland and shrub',
      tradingBroadHabitat: 'Heathland and shrub',
      distinctiveness: 'Medium',
      netUnitChange: 0.18054489048
    },
    {
      habitatType: 'Heathland and shrub - Gorse scrub',
      broadHabitat: 'Heathland and shrub',
      tradingBroadHabitat: 'Heathland and shrub',
      distinctiveness: 'Medium',
      netUnitChange: -2
    },
    {
      habitatType: 'Heathland and shrub - Mixed scrub',
      broadHabitat: 'Heathland and shrub',
      tradingBroadHabitat: 'Heathland and shrub',
      distinctiveness: 'Medium',
      netUnitChange: 0
    },
    {
      habitatType: 'Heathland and shrub - Willow scrub',
      broadHabitat: 'Heathland and shrub',
      tradingBroadHabitat: 'Heathland and shrub',
      distinctiveness: 'Medium',
      netUnitChange: 0.39843540385616
    },
    {
      habitatType:
        'Intertidal hard structures - Artificial hard structures with integrated greening of grey infrastructure (IGGI)',
      broadHabitat: 'Intertidal hard structures',
      tradingBroadHabitat: 'Intertidal sediment and hard structures',
      distinctiveness: 'Medium',
      netUnitChange: -4
    },
    {
      habitatType: 'Intertidal sediment - Littoral coarse sediment',
      broadHabitat: 'Intertidal sediment',
      tradingBroadHabitat: 'Intertidal sediment and hard structures',
      distinctiveness: 'Medium',
      netUnitChange: -4
    },
    {
      habitatType: 'Intertidal sediment - Littoral sand',
      broadHabitat: 'Intertidal sediment',
      tradingBroadHabitat: 'Intertidal sediment and hard structures',
      distinctiveness: 'Medium',
      netUnitChange: 0
    },
    {
      habitatType: 'Lakes - Reservoirs',
      broadHabitat: 'Lakes',
      tradingBroadHabitat: 'Lakes',
      distinctiveness: 'Medium',
      netUnitChange: 2.953733156276
    },
    {
      habitatType: 'Urban - Allotments',
      broadHabitat: 'Urban',
      tradingBroadHabitat: 'Urban',
      distinctiveness: 'Low',
      netUnitChange: -30
    },
    {
      habitatType: 'Urban - Bioswale',
      broadHabitat: 'Urban',
      tradingBroadHabitat: 'Urban',
      distinctiveness: 'Low',
      netUnitChange: -60
    },
    {
      habitatType: "Woodland and forest - Other Scot's pine woodland",
      broadHabitat: 'Woodland and forest',
      tradingBroadHabitat: 'Woodland and forest',
      distinctiveness: 'Medium',
      netUnitChange: 0
    }
  ],
  medium: {
    broadHabitats: [
      {
        broadHabitat: 'Grassland',
        netUnitChange: 119.56850290802
      },
      {
        broadHabitat: 'Heathland and shrub',
        netUnitChange: -1.42101970566384
      },
      {
        broadHabitat: 'Intertidal sediment and hard structures',
        netUnitChange: -8
      },
      {
        broadHabitat: 'Lakes',
        netUnitChange: 2.953733156276
      },
      {
        broadHabitat: 'Woodland and forest',
        netUnitChange: 0
      }
    ],
    surplus: 122.522236064296,
    deficit: -9.42101970566384
  },
  low: {
    netUnitChange: -90,
    cumulativeAvailability: 32.522236064296
  }
}
