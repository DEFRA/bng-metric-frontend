import { MAX_FILE_SIZE_BYTES } from '../../server/common/constants/file-upload.js'

const ALLOWED_EXTENSION = '.gpkg'
const MAX_FILE_SIZE_LABEL = '100 MB'

/**
 * Initialises client-side validation for the file upload form.
 * Validates file extension and size before submission.
 * Gracefully degrades — if JS is unavailable, the server handles validation.
 */
export function initFileUploadValidation() {
  const form = document.querySelector('form[enctype="multipart/form-data"]')

  if (!form) {
    return
  }

  const fileInput = form.querySelector('input[type="file"]')

  if (!fileInput) {
    return
  }

  fileInput.addEventListener('change', () => {
    clearErrors(form, fileInput)

    const file = fileInput.files[0]

    if (!file) {
      return
    }

    const errors = validateFile(file)

    if (errors.length) {
      fileInput.value = ''
      showErrors(form, fileInput, errors)
    }
  })

  form.addEventListener('submit', (event) => {
    clearErrors(form, fileInput)

    const file = fileInput.files[0]
    const errors = validateFile(file)

    if (errors.length) {
      event.preventDefault()
      showErrors(form, fileInput, errors)
    }
  })
}

function validateFile(file) {
  if (!file) {
    return ['Select a GeoPackage (.gpkg) file']
  }

  const errors = []

  if (!file.name.toLowerCase().endsWith(ALLOWED_EXTENSION)) {
    errors.push('The selected file must be a GeoPackage (.gpkg)')
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(`The selected file must be smaller than ${MAX_FILE_SIZE_LABEL}`)
  }

  return errors
}

function showErrors(form, fileInput, errors) {
  const formGroupId = fileInput.id

  // Add error summary at top of form's content area
  const contentBlock = form.closest('.govuk-grid-column-two-thirds')
  const existingSummary = contentBlock?.querySelector('.govuk-error-summary')

  if (!existingSummary && contentBlock) {
    const summaryTemplate = document.querySelector('#tpl-error-summary')
    const summary = summaryTemplate.content.firstElementChild.cloneNode(true)
    const errorList = summary.querySelector('.govuk-error-summary__list')

    errors.forEach((text) => {
      const li = document.createElement('li')
      const link = document.createElement('a')
      link.href = `#${formGroupId}`
      link.textContent = text
      li.appendChild(link)
      errorList.appendChild(li)
    })

    contentBlock.insertBefore(summary, contentBlock.firstChild)
    summary.focus()
  }

  // Add inline errors to the form group
  const formGroup = fileInput.closest('.govuk-form-group')

  if (formGroup) {
    formGroup.classList.add('govuk-form-group--error')

    const errorMessageTemplate = document.querySelector('#tpl-error-message')

    const errorIds = errors.map((text, index) => {
      const errorId = `${formGroupId}-error-${index}`
      const errorMessage =
        errorMessageTemplate.content.firstElementChild.cloneNode(true)
      errorMessage.id = errorId
      errorMessage.querySelector('[data-error-text]').textContent = text
      fileInput.parentNode.insertBefore(errorMessage, fileInput)
      return errorId
    })

    fileInput.setAttribute('aria-describedby', errorIds.join(' '))
    fileInput.classList.add('govuk-file-upload--error')
  }

  // Update page title to indicate error
  const title = document.querySelector('title')
  if (title && !title.textContent.startsWith('Error:')) {
    title.textContent = `Error: ${title.textContent}`
  }
}

function clearErrors(form, fileInput) {
  const contentBlock = form.closest('.govuk-grid-column-two-thirds')
  const clientSummary = contentBlock?.querySelector('[data-client-error]')
  clientSummary?.remove()

  const formGroup = fileInput.closest('.govuk-form-group')

  if (formGroup) {
    formGroup.classList.remove('govuk-form-group--error')
    formGroup
      .querySelectorAll('.govuk-error-message')
      .forEach((el) => el.remove())
  }

  fileInput.removeAttribute('aria-describedby')
  fileInput.classList.remove('govuk-file-upload--error')

  const title = document.querySelector('title')
  if (title) {
    title.textContent = title.textContent.replace(/^Error: /, '')
  }
}
