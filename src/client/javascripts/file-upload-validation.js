import { validateFile } from './file-validation-rules.js'

const FILE_UPLOAD_BUTTON_CLASS = 'govuk-file-upload-button'
const HASH_PREFIX = '#'
const SCROLL_INTO_VIEW = { block: 'center', inline: 'nearest' }
const ERROR_SUMMARY_SELECTOR = '.govuk-error-summary'
const FORM_GROUP_SELECTOR = '.govuk-form-group'

/**
 * Initialises client-side validation for the file upload form.
 * Clears previous errors when a file is chosen. Validates extension, size
 * and filename when Continue is pressed.
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
    clearErrors(fileInput)
  })

  form.addEventListener('submit', (event) => {
    clearErrors(fileInput)

    const file = fileInput.files[0]
    const errors = validateFile(file)

    if (errors.length) {
      event.preventDefault()
      showErrors(form, fileInput, errors)
    }
  })
}

function visibleFileControl(fileInput) {
  const wrapper = fileInput.closest('.govuk-file-upload-wrapper')
  const button = wrapper?.querySelector(`.${FILE_UPLOAD_BUTTON_CLASS}`)
  if (button?.id) {
    return button
  }
  return fileInput
}

function revealFileControl(fileInput, focusTarget) {
  const scrollTarget = fileInput.closest(FORM_GROUP_SELECTOR) ?? focusTarget
  scrollTarget.scrollIntoView(SCROLL_INTO_VIEW)
  focusTarget.focus()
}

function visibleErrorSummaries() {
  return [...document.querySelectorAll(ERROR_SUMMARY_SELECTOR)].filter(
    (element) => !element.closest('template')
  )
}

function showErrorSummary(contentBlock, fileInput, errors) {
  const focusTarget = visibleFileControl(fileInput)
  const summaryTemplate = document.querySelector('#tpl-error-summary')
  const summary = summaryTemplate.content.firstElementChild.cloneNode(true)
  const summaryBody = summary.querySelector('.govuk-error-summary__body')
  const errorList = document.createElement('ul')
  errorList.className = 'govuk-list govuk-error-summary__list'
  summaryBody.appendChild(errorList)

  errors.forEach((text) => {
    const li = document.createElement('li')
    const link = document.createElement('a')
    link.href = `${HASH_PREFIX}${focusTarget.id}`
    link.textContent = text
    link.addEventListener('click', (event) => {
      event.preventDefault()
      revealFileControl(fileInput, focusTarget)
    })
    li.appendChild(link)
    errorList.appendChild(li)
  })

  contentBlock.insertBefore(summary, contentBlock.firstChild)
  summary.focus()
}

function showErrors(form, fileInput, errors) {
  const formGroupId = fileInput.id
  const contentBlock = form.closest('.govuk-grid-column-two-thirds')

  if (contentBlock) {
    showErrorSummary(contentBlock, fileInput, errors)
  }

  const formGroup = fileInput.closest(FORM_GROUP_SELECTOR)

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

  const title = document.querySelector('title')
  if (title && !title.textContent.startsWith('Error:')) {
    title.textContent = `Error: ${title.textContent}`
  }
}

function clearErrors(fileInput) {
  visibleErrorSummaries().forEach((summary) => {
    summary.remove()
  })

  const formGroup = fileInput.closest(FORM_GROUP_SELECTOR)

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
