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
    expect($('#area-habitats-heading').text().trim()).toBe('Area habitats')
    expect($('#area-habitats-heading a')).toHaveLength(0)
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

  test('renders the heading as a link when headingHref is supplied', () => {
    const $ = renderComponent('unit-type-summary', {
      ...summary,
      headingHref: '/projects/123/area-summary'
    })

    const headingLink = $('#area-habitats-heading a')

    expect(headingLink).toHaveLength(1)
    expect(headingLink.attr('href')).toBe('/projects/123/area-summary')
    expect(headingLink.text()).toBe('Area habitats')
  })

  test('uses body typography for the text-only post-intervention action', () => {
    const $ = renderComponent('unit-type-summary', {
      ...summary,
      postIntervention: {
        ...summary.postIntervention,
        action: { text: 'View on-site post intervention' }
      }
    })
    const postInterventionTile = $('.app-unit-type-summary__secondary')
      .find('.app-unit-type-summary__tile')
      .eq(1)
    const action = postInterventionTile.find('p.govuk-body')

    expect(action).toHaveLength(1)
    expect(action.hasClass('govuk-!-margin-bottom-0')).toBe(true)
    expect(action.text().trim()).toBe('View on-site post intervention')
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

  test('omits the baseline action when one does not apply', () => {
    const $ = renderComponent('unit-type-summary', {
      ...summary,
      baseline: { units: '0.00 units', action: null }
    })
    const baselineTile = $('.app-unit-type-summary__secondary')
      .find('.app-unit-type-summary__tile')
      .eq(0)

    expect(baselineTile.text()).toContain('0.00 units')
    expect(baselineTile.find('.govuk-body')).toHaveLength(0)
    expect(baselineTile.text()).not.toContain('View on-site baseline')
  })
})
