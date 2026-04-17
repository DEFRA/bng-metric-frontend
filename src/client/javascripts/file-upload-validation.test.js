// @vitest-environment happy-dom
import { initFileUploadValidation } from './file-upload-validation.js'

function createUploadForm() {
  document.body.innerHTML = `
    <div class="govuk-grid-column-two-thirds">
      <form enctype="multipart/form-data">
        <div class="govuk-form-group">
          <input type="file" id="file" class="govuk-file-upload" />
        </div>
        <button type="submit">Upload</button>
      </form>
    </div>`
  document.head.innerHTML = '<title>Upload Baseline File</title>'
}

function createFile(name, size) {
  return new File([new ArrayBuffer(size)], name)
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

  describe('on file change', () => {
    test('Should show error for non-.gpkg file', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      expect(document.body.innerHTML).toContain(
        'The selected file must be a GeoPackage (.gpkg)'
      )
    })

    test('Should show error for file exceeding 100 MB', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.gpkg', 104857601)]
      })

      input.dispatchEvent(new Event('change'))

      expect(document.body.innerHTML).toContain(
        'The selected file must be smaller than 100 MB'
      )
    })

    test('Should show multiple errors for wrong extension and size', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 104857601)]
      })

      input.dispatchEvent(new Event('change'))

      expect(document.body.innerHTML).toContain(
        'The selected file must be a GeoPackage (.gpkg)'
      )
      expect(document.body.innerHTML).toContain(
        'The selected file must be smaller than 100 MB'
      )
    })

    test('Should not show errors for valid .gpkg file under limit', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.gpkg', 100)]
      })

      input.dispatchEvent(new Event('change'))

      expect(document.querySelector('.govuk-error-summary')).toBeNull()
    })

    test('Should clear file input value when validation fails', () => {
      const input = document.querySelector('#file')
      Object.defineProperty(input, 'files', {
        value: [createFile('data.csv', 100)]
      })

      input.dispatchEvent(new Event('change'))

      expect(input.value).toBe('')
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

      expect(document.title).toBe('Error: Upload Baseline File')
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
      expect(document.title).toBe('Upload Baseline File')
    })
  })
})
