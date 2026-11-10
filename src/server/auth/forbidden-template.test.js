import { load } from 'cheerio'

import { pageErrorText } from '../common/error-text/error-text.js'
import { renderTemplate } from '../test-helpers/render-template.js'

describe('access denied page', () => {
  const page = pageErrorText('accessDenied')
  const $ = load(
    renderTemplate('auth/forbidden.njk', {
      pageTitle: page.title,
      heading: page.title,
      body: page.body
    })
  )

  test("shows error-text.yaml's paragraphs, the first marked for tests", () => {
    expect($('[data-testid="forbidden-body"]').text().trim()).toBe(
      'You do not have permission to view this page.'
    )
    expect($('.govuk-body').eq(1).text()).toContain(
      'approved BNG completer role'
    )
  })

  test('links back to the home page', () => {
    const link = $('.govuk-body a.govuk-link')
    expect(link.text()).toBe('Return to the home page')
    expect(link.attr('href')).toBe('/')
  })
})
