import { buildHabitatPostIntervention } from './create-habitat-post-intervention-controller.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const TRADING_HREF = `/projects/${PROJECT_ID}/area-trading-summary`

const config = {
  path: 'area-post-intervention',
  label: 'Area habitats',
  habitatKey: 'habitats',
  habitatNoun: 'area',
  baselineUnits: () => 1,
  buildIntervention: () => ({
    units: 2,
    netUnitChange: 1,
    netPercentageChange: 100
  }),
  baselineAction: () => null
}

describe('area post-intervention trading link', () => {
  test('includes the trading link in navigation and results after PI upload', () => {
    const project = {
      baseline: { habitats: [] },
      postIntervention: { habitats: [], units: {} }
    }
    const viewModel = buildHabitatPostIntervention(project, PROJECT_ID, config)
    const areaNav = viewModel.navigationItems.find(
      (item) => item.text === 'Area habitats'
    )

    expect(areaNav.children).toContainEqual({
      text: 'Trading Rules',
      href: TRADING_HREF
    })
    expect(viewModel.unitSummary.tradingRules).toEqual({
      text: 'View area trading rules',
      href: TRADING_HREF,
      status: null
    })
  })
})
