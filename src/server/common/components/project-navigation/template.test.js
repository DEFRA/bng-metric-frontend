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
})
