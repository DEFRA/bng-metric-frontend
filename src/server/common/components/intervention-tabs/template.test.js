import { renderComponent } from '../../test-helpers/component-helpers.js'

const items = [
  {
    id: 'retained',
    label: 'Retained',
    panel: { html: '<p>Retained panel</p>' }
  },
  {
    id: 'enhanced',
    label: 'Enhanced',
    panel: { html: '<p>Enhanced panel</p>' }
  },
  { id: 'created', label: 'Created', panel: { html: '<p>Created panel</p>' } }
]

describe('Intervention tabs component', () => {
  test('renders the selected tab as plain text and the others as hash links', () => {
    const $ = renderComponent('intervention-tabs', {
      title: 'Intervention type',
      items
    })

    const selected = $('.govuk-tabs__list-item--selected .govuk-tabs__tab')

    expect($('.govuk-tabs__title').text().trim()).toBe('Intervention type')
    expect(selected.get(0).tagName).toBe('span')
    expect(selected.attr('aria-current')).toBe('true')
    expect(selected.attr('tabindex')).toBe('-1')
    expect(selected.text().trim()).toBe('Retained')
    expect($('#retained').attr('tabindex')).toBe('-1')
    expect($('#enhanced').attr('tabindex')).toBe('-1')
    expect(
      $('.govuk-tabs__list-item--selected a.govuk-tabs__tab')
    ).toHaveLength(0)
    expect($('a.govuk-tabs__tab').eq(0).attr('href')).toBe('#enhanced')
    expect($('a.govuk-tabs__tab').eq(1).attr('href')).toBe('#created')
    expect($('#retained').hasClass('govuk-tabs__panel--hidden')).toBe(false)
    expect($('#enhanced').hasClass('govuk-tabs__panel--hidden')).toBe(true)
    expect($('#created').hasClass('govuk-tabs__panel--hidden')).toBe(true)
  })

  test('renders a single tab as plain text with no links', () => {
    const $ = renderComponent('intervention-tabs', {
      title: 'Intervention type',
      items: [items[2]]
    })

    expect($('.govuk-tabs__tab').text().trim()).toBe('Created')
    expect($('a.govuk-tabs__tab')).toHaveLength(0)
    expect($('span.govuk-tabs__tab').attr('aria-current')).toBe('true')
    expect($('#created').hasClass('govuk-tabs__panel--hidden')).toBe(false)
  })
})
