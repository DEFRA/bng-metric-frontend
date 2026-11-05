import {
  selectedHabitat,
  YEAR_OPTIONS
} from '../../shared/created-area-details.js'
import { ENCROACHMENT_FIELDS } from './created-area-edit-fields.js'
import { unsupportedStoredSignificance } from './created-edit-read-only.js'

export function createdChoiceValues(values, feature, reference, kind) {
  if (!kind.defaultsUnsupportedChoices) {
    return values
  }
  const type = selectedHabitat(reference, values)
  const choices = {
    habitatType: reference.habitatTypes.map((item) => item.name),
    condition: (type?.conditions ?? []).map((item) => item.condition),
    strategicSignificance: reference.strategicSignificance.map(
      (item) => item.value
    ),
    advanceYears: YEAR_OPTIONS,
    delayYears: YEAR_OPTIONS,
    ...(kind.hasEncroachments
      ? Object.fromEntries(
          ENCROACHMENT_FIELDS.map((field) => [field, reference[field]])
        )
      : {})
  }
  const result = { ...values }
  for (const [field, options] of Object.entries(choices)) {
    result[field] = options.includes(values[field]) ? values[field] : ''
  }
  if (unsupportedStoredSignificance(feature, reference) !== null) {
    result.strategicSignificance = ''
  }
  return result
}
