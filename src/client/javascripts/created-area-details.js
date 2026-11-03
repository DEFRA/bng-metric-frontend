import {
  createdAreaDerived,
  createdDerivedInputsUnchanged,
  selectedHabitat,
  UNCHANGED_VALUE
} from '../../shared/created-area-details.js'

const DERIVED_LABELS = {
  distinctivenessDisplay: 'Distinctiveness (multiplier)',
  standardTimeToTargetDisplay: 'Standard time to target condition',
  standardDifficultyDisplay: 'Standard difficulty',
  finalTimeToTargetDisplay: 'Final time to target condition (multiplier)',
  appliedDifficultyMultiplierDisplay: 'Applied difficulty multiplier'
}

function createDerivedUpdater(reference, values, baselineCondition) {
  const initialValues = values()
  const initialDerived = createdAreaDerived(
    reference,
    initialValues,
    baselineCondition
  )
  const initialLabels = Object.fromEntries(
    Object.keys(initialDerived).map((id) => [
      id,
      document.getElementById(id).textContent
    ])
  )
  return () => {
    const changed = []
    const currentValues = values()
    const nextDerived = createdAreaDerived(
      reference,
      currentValues,
      baselineCondition
    )
    for (const [id, value] of Object.entries(nextDerived)) {
      const element = document.getElementById(id)
      const originalInputs = createdDerivedInputsUnchanged(
        id,
        currentValues,
        initialValues
      )
      const label = originalInputs ? initialLabels[id] : value
      if (element.textContent !== label) {
        element.textContent = label
        changed.push(`${DERIVED_LABELS[id]}: ${label || 'Not available'}.`)
      }
    }
    if (changed.length) {
      document.getElementById('created-area-results-status').textContent =
        changed.join(' ')
    }
  }
}

export function initCreatedAreaDetails() {
  const dataElement = document.getElementById('created-area-reference-data')
  if (!dataElement) {
    return
  }
  const reference = JSON.parse(dataElement.textContent)
  const form = document.getElementById('created-area-details-form')
  const values = () => Object.fromEntries(new FormData(form))
  const baselineCondition = dataElement.dataset.baselineCondition ?? ''
  const updateDerived = createDerivedUpdater(
    reference,
    values,
    baselineCondition
  )
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
  document.getElementById('broadHabitat')?.addEventListener('change', () => {
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
    reset('condition', 'target condition', [
      ...(type?.conditions ?? []).map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`
      })),
      ...(reference.importedCondition &&
      reference.importedCondition.habitatType === type?.name
        ? [
            {
              value: UNCHANGED_VALUE,
              text: `${reference.importedCondition.condition} (imported value)`
            }
          ]
        : [])
    ])
    updateDerived()
  })
  for (const id of ['condition', 'advanceYears', 'delayYears']) {
    document.getElementById(id).addEventListener('change', updateDerived)
  }
}
