import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { createdStrategicSignificance } from './created-strategic-significance.js'
import {
  selectedHabitat,
  MAX_YEARS,
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

function yearValue(value, is30Plus) {
  if (value === null || value === undefined) {
    return ''
  }
  return is30Plus && Number(value) === MAX_YEARS ? '30+' : String(value)
}

export function createdAreaValues(feature) {
  const proposed = feature.proposed ?? {}
  return {
    ref: String(feature.ref ?? ''),
    broadHabitat: proposed.broadType ?? '',
    habitatType: proposed.type ?? '',
    condition: stripConditionPrefix(proposed.condition) ?? '',
    strategicSignificance: createdStrategicSignificance(
      proposed.strategicSignificanceCategory ??
        proposed.strategicSignificance ??
        ''
    ),
    advanceYears: yearValue(
      proposed.advanceYears,
      proposed.advanceYearsIs30Plus
    ),
    delayYears: yearValue(proposed.delayYears, proposed.delayYearsIs30Plus),
    ...Object.fromEntries(
      ENCROACHMENT_FIELDS.filter((field) => Object.hasOwn(proposed, field)).map(
        (field) => [field, proposed[field] ?? '']
      )
    )
  }
}

export function createdHintValues(feature, reference, storedValues) {
  const raw = createdAreaValues(feature)
  const unsupported = unsupportedStoredSignificance(feature, reference)
  if (unsupported !== null) {
    raw.strategicSignificance = unsupported
  }
  return Object.fromEntries(
    Object.entries(storedValues).map(([field, value]) => [
      field,
      value === '' && raw[field] != null && raw[field] !== ''
        ? String(raw[field])
        : value
    ])
  )
}
