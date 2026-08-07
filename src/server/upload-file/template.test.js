import { load } from 'cheerio'

import { renderTemplate } from '../test-helpers/render-template.js'
import {
  BASELINE_REQUIRED_ERROR,
  FILE_TYPES,
  SELECT_FILE_TYPE_ERROR
} from './controller.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

function render(error, selected) {
  return load(
    renderTemplate('upload-file/index.njk', {
      pageTitle: error
        ? 'Error: What would you like to upload?'
        : 'What would you like to upload?',
      heading: 'What would you like to upload?',
      caption: 'Habitat project',
      projectId: PROJECT_ID,
      returnUrl: `/add-project-details/${PROJECT_ID}`,
      backHref: `/add-project-details/${PROJECT_ID}`,
      cancelHref: `/add-project-details/${PROJECT_ID}`,
      crumb: 'csrf-token',
      items: Object.values(FILE_TYPES).map(({ value, text }) => ({
        value,
        text,
        checked: value === selected
      })),
      error
    })
  )
}

describe('upload file template', () => {
  test('renders the required page content and controls', () => {
    const $ = render()

    expect($('h1').text()).toContain('What would you like to upload?')
    expect($('.govuk-caption-m').text()).toContain('Habitat project')
    expect($('main').text()).toContain(
      'Uploading a file will overwrite any previous files you have uploaded.'
    )
    expect($('input[name="uploadType"]')).toHaveLength(2)
    expect($('label[for="uploadType"]').text()).toContain(
      FILE_TYPES.baseline.text
    )
    expect($('label[for="uploadType-2"]').text()).toContain(
      FILE_TYPES.postIntervention.text
    )
    expect($('button').text()).toContain('Continue')
    expect($('a.govuk-back-link').attr('href')).toBe(
      `/add-project-details/${PROJECT_ID}`
    )
    expect($('a.govuk-link').last().text()).toContain('Cancel')
    expect($('input[name="crumb"]').attr('value')).toBe('csrf-token')
  })

  test.each([SELECT_FILE_TYPE_ERROR, BASELINE_REQUIRED_ERROR])(
    'renders the error summary and inline error for %s',
    (error) => {
      const $ = render(error, FILE_TYPES.postIntervention.value)

      expect($('.govuk-error-summary__title').text()).toContain(
        'There is a problem'
      )
      expect($('.govuk-error-summary__list').text()).toContain(error)
      expect($('.govuk-error-message').text()).toContain(error)
      expect($('#uploadType-2').is(':checked')).toBe(true)
    }
  )
})
