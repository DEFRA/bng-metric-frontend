import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { createdStrategicSignificance } from './created-strategic-significance.js'
import { MAX_YEARS } from '../../shared/created-area-details.js'
import { ENCROACHMENT_FIELDS } from './created-area-edit-fields.js'

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
    strategicSignificance: significanceValue(proposed),
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

// Preserve unsupported imports; they are not offered as newly selectable valid values.
export function createdImportedChoices(feature, reference, kind) {
  const values = createdAreaValues(feature)
  const choices = {
    strategicSignificance: reference.strategicSignificance.map((s) => s.value),
    ...(kind.preservesImportedType
      ? { habitatType: reference.habitatTypes.map((t) => t.name) }
      : {}),
    ...(kind.hasEncroachments
      ? {
          ...Object.fromEntries(
            ENCROACHMENT_FIELDS.map((field) => [field, reference[field]])
          )
        }
      : {})
  }
  return Object.fromEntries(
    Object.entries(choices)
      .filter(
        ([field, options]) => values[field] && !options.includes(values[field])
      )
      .map(([field]) => [field, values[field]])
  )
}

function significanceValue(proposed) {
  // Keep the merged editors' category precedence, including an explicit clear.
  // Historical rejection metadata must never override a current saved choice.
  return createdStrategicSignificance(
    proposed.strategicSignificanceCategory ??
      proposed.strategicSignificance ??
      proposed.rejectedStrategicSignificance ??
      ''
  )
}
