import {
  createdAreaDerived,
  selectedHabitat
} from '../../shared/created-area-details.js'

export function initCreatedAreaDetails() {
  const dataElement = document.getElementById('created-area-reference-data')
  if (!dataElement) {
    return
  }
  const reference = JSON.parse(dataElement.textContent)
  const form = document.getElementById('created-area-details-form')
  const values = () => Object.fromEntries(new FormData(form))
  const updateDerived = () => {
    for (const [id, value] of Object.entries(
      createdAreaDerived(reference, values())
    )) {
      document.getElementById(id).textContent = value
    }
  }
  const reset = (id, label, options = []) => {
    const select = document.getElementById(id)
    const option = ({ value, text }) => {
      const element = document.createElement('option')
      element.value = value
      element.textContent = text
      return element
    }
    select.replaceChildren(
      option({ value: '', text: `Choose ${label}` }),
      ...options.map(option)
    )
    select.value = ''
  }
  document.getElementById('broadHabitat').addEventListener('change', () => {
    const broad = values().broadHabitat
    reset(
      'habitatType',
      'habitat type',
      reference.habitatTypes
        .filter((t) => t.broad === broad)
        .map((t) => ({ value: t.name, text: t.name }))
    )
    reset('condition', 'target condition')
    updateDerived()
  })
  document.getElementById('habitatType').addEventListener('change', () => {
    const type = selectedHabitat(reference, values())
    reset(
      'condition',
      'target condition',
      (type?.conditions ?? []).map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`
      }))
    )
    updateDerived()
  })
  for (const id of ['condition', 'advanceYears', 'delayYears']) {
    document.getElementById(id).addEventListener('change', updateDerived)
  }
}
