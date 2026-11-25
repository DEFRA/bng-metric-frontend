import { load } from 'cheerio'

import { pageErrorText } from '../common/error-text/error-text.js'
import { renderTemplate } from '../test-helpers/render-template.js'

describe('Private Beta drop-out page (BMD-1104 AC9)', () => {
  const page = pageErrorText('privateBeta')
  const $ = load(
    renderTemplate('auth/private-beta.njk', {
      pageTitle: page.title,
      heading: page.title,
      body: page.body
    })
  )

  test('shows the heading', () => {
    expect($('h1').text()).toContain('You cannot use this service yet')
  })

  test('says the service is in Private Beta, in the first paragraph', () => {
    expect($('[data-testid="private-beta-body"]').text()).toContain(
      'This service is in Private Beta'
    )
  })

  test('tells the user to continue to use the Statutory Biodiversity Metric Excel tool', () => {
    expect($('.govuk-body').text()).toContain(
      'Continue to use the Statutory Biodiversity Metric Excel tool'
    )
  })

  test('links back to the home page', () => {
    const link = $('.govuk-body a.govuk-link')
    expect(link.text()).toBe('Return to the home page')
    expect(link.attr('href')).toBe('/')
  })
})
