const ALLOWED_EXTENSION = '.gpkg'
const MAX_FILE_SIZE_BYTES = 104857600
const MAX_FILE_SIZE_LABEL = '100MB'

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
    const errorItems = errors
      .map((text) => `<li><a href="#${formGroupId}">${text}</a></li>`)
      .join('')

    const summary = document.createElement('div')
    summary.className = 'govuk-error-summary'
    summary.setAttribute('data-module', 'govuk-error-summary')
    summary.setAttribute('data-client-error', 'true')
    summary.innerHTML = `
      <div role="alert">
        <h2 class="govuk-error-summary__title">There is a problem</h2>
        <div class="govuk-error-summary__body">
          <ul class="govuk-list govuk-error-summary__list">
            ${errorItems}
          </ul>
        </div>
      </div>`

    contentBlock.insertBefore(summary, contentBlock.firstChild)
    summary.focus()
  }

  // Add inline errors to the form group
  const formGroup = fileInput.closest('.govuk-form-group')

  if (formGroup) {
    formGroup.classList.add('govuk-form-group--error')

    const errorIds = errors.map((text, index) => {
      const errorId = `${formGroupId}-error-${index}`
      const errorSpan = document.createElement('p')
      errorSpan.id = errorId
      errorSpan.className = 'govuk-error-message'
      errorSpan.innerHTML = `<span class="govuk-visually-hidden">Error:</span> ${text}`
      fileInput.parentNode.insertBefore(errorSpan, fileInput)
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
