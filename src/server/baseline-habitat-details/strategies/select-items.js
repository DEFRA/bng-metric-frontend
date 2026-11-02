// The dropdown items the baseline details strategies render (area, hedgerow,
// watercourse).
//
// The options come from the current reference data. A habitat saved earlier
// can hold a value that is no longer among them — a habitat type or condition
// the reference data has since dropped, or an import that predates a check.
// Left out, the browser would show the blank choice and the next save, even
// one that only renames the habitat, would send it blank and clear the stored
// value. So a saved value missing from the options is kept as a selected
// option of its own, and a save sends it back unchanged.

/**
 * @param {string[]} values the options from the reference data
 * @param {string|null|undefined} selectedValue the saved (or submitted) value
 * @param {string} defaultText the blank choice's text
 * @returns {Array<{ value: string, text: string, selected: boolean }>}
 */
export function buildSelectItems(values, selectedValue, defaultText) {
  const items = [{ value: '', text: defaultText, selected: !selectedValue }]
  for (const value of values) {
    items.push({ value, text: value, selected: value === selectedValue })
  }
  if (selectedValue && !values.includes(selectedValue)) {
    items.push({ value: selectedValue, text: selectedValue, selected: true })
  }
  return items
}

/**
 * The condition dropdown: each condition with its score, plus a saved
 * condition the list no longer holds.
 *
 * @param {Array<{ condition: string, score: number }>} conditions
 * @param {string|null|undefined} savedCondition
 * @returns {Array<{ value: string, text: string, selected: boolean }>}
 */
export function buildConditionItems(conditions, savedCondition) {
  const items = [
    { value: '', text: 'Choose condition', selected: !savedCondition },
    ...conditions.map((c) => ({
      value: c.condition,
      text: `${c.condition} (${c.score})`,
      selected: c.condition === savedCondition
    }))
  ]
  if (
    savedCondition &&
    !conditions.some((c) => c.condition === savedCondition)
  ) {
    items.push({ value: savedCondition, text: savedCondition, selected: true })
  }
  return items
}
