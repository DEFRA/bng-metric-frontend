import { renderComponent } from '../../test-helpers/component-helpers.js'

const summary = {
  id: 'area-habitats',
  label: 'Area habitats',
  netPercentageChange: '-100.00%',
  status: { text: 'Not met', classes: 'govuk-tag--red' },
  tradingRules: { text: 'View trading rules' },
  baseline: {
    units: '1.52 units',
    action: { text: 'View on-site baseline' }
  },
  postIntervention: {
    heading: 'On-site post intervention',
    units: '0.00 units',
    action: { text: 'Upload post-intervention file', href: '/upload' }
  },
  netUnitChange: '-1.52 units'
}

describe('Unit type summary component', () => {
  test('renders the supplied summary values and status', () => {
    const $ = renderComponent('unit-type-summary', summary)

    expect($('section').attr('aria-labelledby')).toBe('area-habitats-heading')
    expect($('#area-habitats-heading').text()).toBe('Area habitats')
    expect($('.app-unit-type-summary__tile')).toHaveLength(5)
    expect($('.govuk-tag').text()).toBe('Not met')
    expect($('.govuk-tag').hasClass('govuk-tag--red')).toBe(true)
    expect($('section').text()).toContain('-100.00%')
    expect($('section').text()).toContain('1.52 units')
    expect($('section').text()).toContain('-1.52 units')
  })

  test('supports linked and text-only actions', () => {
    const $ = renderComponent('unit-type-summary', summary)

    expect($('a')).toHaveLength(1)
    expect($('a').attr('href')).toBe('/upload')
    expect($('a').text()).toBe('Upload post-intervention file')
    expect($('section').text()).toContain('View trading rules')
    expect($('section').text()).toContain('View on-site baseline')
  })

  test('does not render an empty status when one does not apply', () => {
    const $ = renderComponent('unit-type-summary', {
      ...summary,
      netPercentageChange: 'N/A',
      status: null
    })

    expect($('section').text()).toContain('N/A')
    expect($('.govuk-tag')).toHaveLength(0)
  })
})
