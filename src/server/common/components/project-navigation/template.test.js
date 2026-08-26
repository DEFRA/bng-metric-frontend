import { renderComponent } from '../../test-helpers/component-helpers.js'

describe('Project navigation component', () => {
  test('renders current, linked and text-only navigation items', () => {
    const $ = renderComponent('project-navigation', {
      label: 'Project sections',
      items: [
        { text: 'Summary', current: true },
        { text: 'Area habitats', href: '/areas' },
        { text: 'Hedgerows' }
      ]
    })

    expect($('nav').attr('aria-label')).toBe('Project sections')
    expect($('li')).toHaveLength(3)
    expect($('[aria-current="page"]').text()).toBe('Summary')
    expect($('a').attr('href')).toBe('/areas')
    expect($('li').eq(2).text().trim()).toBe('Hedgerows')
    expect($('li').eq(2).find('a')).toHaveLength(0)
  })

  test('renders nested children and marks the current child', () => {
    const $ = renderComponent('project-navigation', {
      label: 'Project sections',
      items: [
        { text: 'Summary', href: '/summary' },
        {
          text: 'Area habitats',
          href: '/area-summary',
          children: [{ text: 'Baseline', current: true }]
        }
      ]
    })

    expect($('.app-project-navigation__item')).toHaveLength(2)
    expect($('.app-project-navigation__child')).toHaveLength(1)
    expect($('[aria-current="page"]').text()).toBe('Baseline')
    expect(
      $('a')
        .filter((_, link) => $(link).text() === 'Area habitats')
        .attr('href')
    ).toBe('/area-summary')
  })
})
