import { renderComponent } from '../../test-helpers/component-helpers.js'

const summary = {
  targetPercentage: { text: '10%' },
  unitsRequired: '1.67 units',
  unitDeficit: '0.03 units'
}

describe('Targets summary component', () => {
  test('renders the supplied target values', () => {
    const $ = renderComponent('targets-summary', summary)

    expect($('#targets-heading').text()).toBe('Targets')
    expect($('.app-unit-type-summary__tile')).toHaveLength(3)
    expect($('section').text()).toContain('10%')
    expect($('section').text()).toContain('1.67 units')
    expect($('section').text()).toContain('0.03 units')
  })

  test('renders no links', () => {
    const $ = renderComponent('targets-summary', summary)

    expect($('a')).toHaveLength(0)
  })
})
