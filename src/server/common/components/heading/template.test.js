import { renderComponent } from '../../test-helpers/component-helpers.js'

describe('Heading Component', () => {
  let $heading

  describe('With callBlock', () => {
    beforeEach(() => {
      $heading = renderComponent(
        'heading',
        { text: 'Title' },
        '<p>Extra content</p>'
      )
    })

    test('Should render with call block content', () => {
      expect($heading('[data-testid="app-heading"]')).toHaveLength(1)
    })
  })

  describe('With caption', () => {
    beforeEach(() => {
      $heading = renderComponent('heading', {
        text: 'Services',
        caption: 'A page showing available services'
      })
    })

    test('Should render app heading component', () => {
      expect($heading('[data-testid="app-heading"]')).toHaveLength(1)
    })

    test('Should contain expected heading', () => {
      expect($heading('[data-testid="app-heading-title"]').text().trim()).toBe(
        'Services'
      )
    })

    test('Should have expected heading caption', () => {
      expect(
        $heading('[data-testid="app-heading-caption"]').text().trim()
      ).toBe('A page showing available services')
    })
  })
})
