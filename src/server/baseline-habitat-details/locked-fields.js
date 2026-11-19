// The baseline details page once post-intervention data is uploaded
// (BMD-1194): every value is read-only text under its usual label, rather than
// an input or dropdown.

// The dropdowns the strategies build, and the display each becomes.
const LOCKED_SELECTS = Object.freeze([
  { options: 'broadHabitatOptions', display: 'broadHabitatDisplay' },
  { options: 'habitatTypeOptions', display: 'habitatTypeDisplay' },
  { options: 'conditionOptions', display: 'conditionDisplay' },
  {
    options: 'watercourseEncroachmentOptions',
    display: 'watercourseEncroachmentDisplay'
  },
  {
    options: 'riparianEncroachmentOptions',
    display: 'riparianEncroachmentDisplay'
  }
])

/**
 * The text of a dropdown's chosen option, as the dropdown would show it, or ''
 * when only the blank choice is selected.
 *
 * @param {Array<{ value: string, text: string, selected: boolean }> | undefined} items
 * @returns {string}
 */
function selectedText(items) {
  return items?.find((item) => item.selected && item.value)?.text ?? ''
}

/**
 * The read-only value of each dropdown in a strategy's view model, keyed by
 * its display name (e.g. `conditionDisplay`). A dropdown the view model does
 * not build gives ''; the page does not show it.
 *
 * @param {object} viewModel
 * @returns {Record<string, string>}
 */
export function lockedFieldDisplays(viewModel) {
  return Object.fromEntries(
    LOCKED_SELECTS.map(({ options, display }) => [
      display,
      selectedText(viewModel[options])
    ])
  )
}
