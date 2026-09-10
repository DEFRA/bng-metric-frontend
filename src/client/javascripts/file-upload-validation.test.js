// @vitest-environment happy-dom
import { vi } from 'vitest'
import { ERROR_INVALID_FILENAME } from '../../server/common/helpers/file-validation-messages.js'
import { renderTemplateIntoDocument } from '../../server/test-helpers/render-template.js'
import { ERROR_WRONG_EXTENSION } from './file-validation-rules.js'
import { initFileUploadValidation } from './file-upload-validation.js'

// Render the real upload-baseline-file template via the same Nunjucks
// config the server uses, so the DOM under test matches what the user
// actually sees. View model fields below are the ones the template
// (and its `layouts/page.njk` parent) require to render the form.
function createUploadForm(viewModel = {}) {
  renderTemplateIntoDocument('upload-geopackage-file.njk', {
    pageTitle: 'Upload Baseline File',
    heading: 'Upload Baseline File',
    caption: 'Test Project',
    projectId: 'test-project',
    uploadUrl: '/upload',
    instructionText: 'Choose a GeoPackage file to upload.',
    ...viewModel
  })
}

function createFile(name, size) {
  return new File([new ArrayBuffer(size)], name)
}

function visibleFormErrorSummary() {
  return document
    .querySelector('form')
    .closest('.govuk-grid-column-two-thirds')
    .querySelector(':scope > .govuk-error-summary')
}

describe('initFileUploadValidation', () => {
  beforeEach(() => {
    createUploadForm()
    initFileUploadValidation()
  })

  test('Should not throw when no form exists', () => {
    document.body.innerHTML = ''
    expect(() => initFileUploadValidation()).not.toThrow()
  })

  test('Should not throw when form has no file input', () => {
    document.body.innerHTML =
      '<form enctype="multipart/form-data"><button>Submit</button></form>'
    expect(() => initFileUploadValidation()).not.toThrow()
  })

  // Validation message text and the no-error case are covered by
  // file-validation-rules.test.js; the DOM-shell tests below assert the
  // wiring (handler side effects, GDS-specific DOM artifacts).
  describe('on file change', () => {
    test('Should clear file input value when validation fails', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      expect(input.value).toBe('')
    })

    test('Should show an inline error for an invalid filename', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile("survey'.gpkg", 100)],
        configurable: true
      })

      input.dispatchEvent(new Event('change'))

      expect(input.value).toBe('')
      expect(document.body.innerHTML).toContain(
        'The file name can only include letters, numbers, spaces, hyphens, underscores, full stops or brackets'
      )
    })
  })

  describe('on form submit', () => {
    test('Should prevent submission when no file is selected', () => {
      const form = document.querySelector('form')
      const event = new Event('submit', { cancelable: true })

      form.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
      expect(document.body.innerHTML).toContain(
        'Select a GeoPackage (.gpkg) file'
      )
    })

    test('Should prevent submission for invalid file', () => {
      const form = document.querySelector('form')
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      const event = new Event('submit', { cancelable: true })
      form.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })

    test('Should show an inline error for a filename the backend would reject', () => {
      const form = document.querySelector('form')
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile("survey'.gpkg", 100)]
      })

      const event = new Event('submit', { cancelable: true })
      form.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
      expect(document.body.innerHTML).toContain(
        'The file name can only include letters, numbers, spaces, hyphens, underscores, full stops or brackets'
      )
    })

    test('Should allow submission for valid .gpkg file', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.gpkg', 100)]
      })

      const form = document.querySelector('form')
      const event = new Event('submit', { cancelable: true })
      form.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('error display', () => {
    test('Should add error summary to content area', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      const summary = document.querySelector('.govuk-error-summary')
      expect(summary).not.toBeNull()
      expect(summary.innerHTML).toContain('There is a problem')
    })

    test('Should add error class to form group', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      const formGroup = document.querySelector('.govuk-form-group')
      expect(formGroup.classList.contains('govuk-form-group--error')).toBe(true)
    })

    test('Should add error class to file input', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      expect(input.classList.contains('govuk-file-upload--error')).toBe(true)
    })

    test('Should prefix page title with Error:', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      expect(document.title.startsWith('Error: ')).toBe(true)
    })

    test('Should add inline error messages with visually hidden prefix', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      const errorMessage = document.querySelector('.govuk-error-message')
      expect(errorMessage).not.toBeNull()
      expect(errorMessage.innerHTML).toContain('govuk-visually-hidden')
    })

    test('Should set aria-describedby on file input', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      expect(input.getAttribute('aria-describedby')).toBeTruthy()
    })

    test('Should focus the visible Choose file button from the error summary', () => {
      const input = document.querySelector('#file')
      const wrapper = input.closest('.govuk-file-upload-wrapper')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'govuk-file-upload-button'
      button.id = 'file'
      button.textContent = 'Choose file'
      wrapper.insertBefore(button, input)
      input.id = 'file-input'

      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })
      input.dispatchEvent(new Event('change'))

      const link = document.querySelector('.govuk-error-summary__list a')
      const formGroup = input.closest('.govuk-form-group')
      const scrollIntoView = vi.fn()
      formGroup.scrollIntoView = scrollIntoView
      expect(link.getAttribute('href')).toBe('#file')

      link.dispatchEvent(
        new Event('click', { bubbles: true, cancelable: true })
      )

      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        inline: 'nearest'
      })
      expect(document.activeElement).toBe(button)
    })
  })

  describe('clearing errors', () => {
    test('Should clear errors when a valid file is selected after an error', () => {
      const input = document.querySelector('#file')

      // First trigger an error
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)],
        configurable: true
      })
      input.dispatchEvent(new Event('change'))
      expect(document.querySelector('.govuk-error-summary')).not.toBeNull()

      // Then select a valid file
      Object.defineProperty(input, 'files', {
        value: [createFile('data.gpkg', 100)],
        configurable: true
      })
      input.dispatchEvent(new Event('change'))

      expect(document.querySelector('.govuk-error-summary')).toBeNull()
      expect(
        document
          .querySelector('.govuk-form-group')
          .classList.contains('govuk-form-group--error')
      ).toBe(false)
      expect(document.title.startsWith('Error: ')).toBe(false)
    })

    test('Should clear a server-rendered error summary when a valid file is selected', () => {
      createUploadForm({
        pageTitle: 'Error: Upload Baseline File',
        error: { text: ERROR_INVALID_FILENAME }
      })
      initFileUploadValidation()

      const input = document.querySelector('#file')
      expect(visibleFormErrorSummary().textContent).toContain(
        ERROR_INVALID_FILENAME
      )

      Object.defineProperty(input, 'files', {
        value: [createFile('data.gpkg', 100)],
        configurable: true
      })
      input.dispatchEvent(new Event('change'))

      expect(visibleFormErrorSummary()).toBeNull()
      expect(
        document
          .querySelector('.govuk-form-group')
          .classList.contains('govuk-form-group--error')
      ).toBe(false)
    })

    test('Should clear an error summary that is not a direct child of the form column', () => {
      createUploadForm({
        pageTitle: 'Error: Upload Baseline File',
        error: { text: ERROR_INVALID_FILENAME }
      })
      initFileUploadValidation()

      const formColumn = document
        .querySelector('form')
        .closest('.govuk-grid-column-two-thirds')
      const summary = visibleFormErrorSummary()
      const main = document.querySelector('main')
      main.insertBefore(summary, main.firstChild)
      expect(formColumn.contains(summary)).toBe(false)

      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.gpkg', 100)],
        configurable: true
      })
      input.dispatchEvent(new Event('change'))

      expect(document.querySelector('main .govuk-error-summary')).toBeNull()
    })

    test('Should replace the error summary when the next file has a different problem', () => {
      const input = document.querySelector('#file')

      Object.defineProperty(input, 'files', {
        value: [createFile("survey'.gpkg", 100)],
        configurable: true
      })
      input.dispatchEvent(new Event('change'))

      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)],
        configurable: true
      })
      input.dispatchEvent(new Event('change'))

      const summary = visibleFormErrorSummary()
      const inlineError = document.querySelector(
        '.govuk-form-group .govuk-error-message'
      )

      expect(summary.textContent).toContain(ERROR_WRONG_EXTENSION)
      expect(summary.textContent).not.toContain(ERROR_INVALID_FILENAME)
      expect(inlineError.textContent).toContain(ERROR_WRONG_EXTENSION)
      expect(inlineError.textContent).not.toContain(ERROR_INVALID_FILENAME)
    })

    test('Should replace a server-rendered summary when the next file has a different problem', () => {
      createUploadForm({
        pageTitle: 'Error: Upload Baseline File',
        error: { text: ERROR_INVALID_FILENAME }
      })
      initFileUploadValidation()

      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)],
        configurable: true
      })
      input.dispatchEvent(new Event('change'))

      const summary = visibleFormErrorSummary()
      const inlineError = document.querySelector(
        '.govuk-form-group .govuk-error-message'
      )

      expect(summary.textContent).toContain(ERROR_WRONG_EXTENSION)
      expect(summary.textContent).not.toContain(ERROR_INVALID_FILENAME)
      expect(inlineError.textContent).toContain(ERROR_WRONG_EXTENSION)
    })
  })
})
