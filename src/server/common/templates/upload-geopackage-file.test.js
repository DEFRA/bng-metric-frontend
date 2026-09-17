import { load } from 'cheerio'

import { ERROR_INVALID_FILENAME } from '../helpers/file-validation-messages.js'
import { renderTemplate } from '../../test-helpers/render-template.js'

const VIEW_MODEL = {
  pageTitle: 'Upload Baseline File',
  heading: 'Upload a GeoPackage (.gpkg) file',
  caption: 'Test Project',
  projectId: 'test-project',
  uploadUrl: '/upload',
  instructionText: 'Choose a GeoPackage file to upload.',
  backHref: '/back',
  cancelHref: '/cancel'
}

function render(viewModel = {}) {
  return load(
    renderTemplate('upload-geopackage-file.njk', {
      ...VIEW_MODEL,
      ...viewModel
    })
  )
}

describe('upload geopackage file template', () => {
  test('places a backend filename error in the same column as client-side errors', () => {
    const $ = render({
      pageTitle: `Error: ${VIEW_MODEL.pageTitle}`,
      error: { text: ERROR_INVALID_FILENAME }
    })

    const column = $('form').closest('.govuk-grid-column-two-thirds')
    const summary = column.children('.govuk-error-summary')

    expect(summary).toHaveLength(1)
    expect(summary.text()).toContain(ERROR_INVALID_FILENAME)
    expect(
      column.find('.govuk-form-group .govuk-error-message').text()
    ).toContain(ERROR_INVALID_FILENAME)
    expect(summary.find('a').attr('href')).toBe('#file')
  })

  test('does not render an error summary when there is no flash error', () => {
    const $ = render()

    expect(
      $('form')
        .closest('.govuk-grid-column-two-thirds')
        .children('.govuk-error-summary')
    ).toHaveLength(0)
    expect($('.govuk-form-group--error')).toHaveLength(0)
  })
})
