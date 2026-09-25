// Area-habitat trading-rules figures for the published worked example
// ("Area Habitat Trading Rules - Worked example"), exactly as the backend saves
// them: bng-library's calculator run over the example's baseline and delivered
// units. The page is validated against the figures the example publishes.

const HEATHLAND_AND_SHRUB = 'Heathland and shrub'
const INTERTIDAL_SEDIMENT_AND_HARD_STRUCTURES =
  'Intertidal sediment and hard structures'
const WOODLAND_AND_FOREST = 'Woodland and forest'

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
      broadHabitat: HEATHLAND_AND_SHRUB,
      tradingBroadHabitat: HEATHLAND_AND_SHRUB,
      distinctiveness: 'Medium',
      netUnitChange: 0.18054489048
    },
    {
      habitatType: 'Heathland and shrub - Gorse scrub',
      broadHabitat: HEATHLAND_AND_SHRUB,
      tradingBroadHabitat: HEATHLAND_AND_SHRUB,
      distinctiveness: 'Medium',
      netUnitChange: -2
    },
    {
      habitatType: 'Heathland and shrub - Mixed scrub',
      broadHabitat: HEATHLAND_AND_SHRUB,
      tradingBroadHabitat: HEATHLAND_AND_SHRUB,
      distinctiveness: 'Medium',
      netUnitChange: 0
    },
    {
      habitatType: 'Heathland and shrub - Willow scrub',
      broadHabitat: HEATHLAND_AND_SHRUB,
      tradingBroadHabitat: HEATHLAND_AND_SHRUB,
      distinctiveness: 'Medium',
      netUnitChange: 0.39843540385616
    },
    {
      habitatType:
        'Intertidal hard structures - Artificial hard structures with integrated greening of grey infrastructure (IGGI)',
      broadHabitat: 'Intertidal hard structures',
      tradingBroadHabitat: INTERTIDAL_SEDIMENT_AND_HARD_STRUCTURES,
      distinctiveness: 'Medium',
      netUnitChange: -4
    },
    {
      habitatType: 'Intertidal sediment - Littoral coarse sediment',
      broadHabitat: 'Intertidal sediment',
      tradingBroadHabitat: INTERTIDAL_SEDIMENT_AND_HARD_STRUCTURES,
      distinctiveness: 'Medium',
      netUnitChange: -4
    },
    {
      habitatType: 'Intertidal sediment - Littoral sand',
      broadHabitat: 'Intertidal sediment',
      tradingBroadHabitat: INTERTIDAL_SEDIMENT_AND_HARD_STRUCTURES,
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
      broadHabitat: WOODLAND_AND_FOREST,
      tradingBroadHabitat: WOODLAND_AND_FOREST,
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
        broadHabitat: HEATHLAND_AND_SHRUB,
        netUnitChange: -1.42101970566384
      },
      {
        broadHabitat: INTERTIDAL_SEDIMENT_AND_HARD_STRUCTURES,
        netUnitChange: -8
      },
      {
        broadHabitat: 'Lakes',
        netUnitChange: 2.953733156276
      },
      {
        broadHabitat: WOODLAND_AND_FOREST,
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
