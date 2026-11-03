import { renderComponent } from '../../test-helpers/component-helpers.js'

describe('Habitat reference input component', () => {
  test('renders a labelled input holding the reference, limited in length', () => {
    const $component = renderComponent('habitat-ref-input', {
      id: 'habitatRef',
      value: 'A1',
      maxLength: 100
    })

    expect($component('label[for="habitatRef"]').text().trim()).toBe(
      'Habitat reference'
    )
    const $input = $component('input#habitatRef')
    expect($input.attr('name')).toBe('habitatRef')
    expect($input.attr('value')).toBe('A1')
    expect($input.attr('maxlength')).toBe('100')
    expect($input.attr('spellcheck')).toBe('false')
    expect(
      $component('.govuk-form-group').hasClass('app-stacked-fields__item')
    ).toBe(true)
    expect($component('.govuk-error-message')).toHaveLength(0)
  })

  test('shows the inline error', () => {
    const $component = renderComponent('habitat-ref-input', {
      id: 'habitatRef',
      value: ' ',
      maxLength: 100,
      error: { text: 'Enter a valid habitat reference.' }
    })

    expect($component('#habitatRef-error').text()).toContain(
      'Enter a valid habitat reference.'
    )
    expect($component('input#habitatRef').hasClass('govuk-input--error')).toBe(
      true
    )
  })
})
