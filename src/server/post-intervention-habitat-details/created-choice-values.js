import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { createdStrategicSignificance } from './created-strategic-significance.js'
import { MAX_YEARS, YEAR_OPTIONS } from '../../shared/created-area-details.js'
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

// The PO's ruling (BMD-1046 testing, across every edit page): a stored choice
// its list does not offer is not shown or kept. It reads as no value, so its
// dropdown shows the default option and a save clears it. That covers a value
// the list no longer offers and one the import rejected (which the backend
// nulls on import).
export function supportedCreatedValues(values, reference, kind) {
  const supported = { ...values }
  for (const [field, options] of createdChoiceLists(
    reference,
    supported,
    kind
  )) {
    if (supported[field] && !options.includes(supported[field])) {
      supported[field] = ''
    }
  }
  return supported
}

// Each choice's options, in page order, so a cleared broad habitat or habitat
// type clears the choices listed under it. `values` is read as it is cleared.
function* createdChoiceLists(reference, values, kind) {
  const types = reference.habitatTypes
  if (kind.hasBroadHabitat) {
    yield ['broadHabitat', [...new Set(types.map((t) => t.broad))]]
  }
  const inBroad = types.filter(
    (t) => !kind.hasBroadHabitat || t.broad === values.broadHabitat
  )
  yield ['habitatType', inBroad.map((t) => t.name)]
  const type = inBroad.find((t) => t.name === values.habitatType)
  yield ['condition', (type?.conditions ?? []).map((c) => c.condition)]
  yield [
    'strategicSignificance',
    reference.strategicSignificance.map((s) => s.value)
  ]
  yield ['advanceYears', YEAR_OPTIONS]
  yield ['delayYears', YEAR_OPTIONS]
  if (kind.hasEncroachments) {
    for (const field of ENCROACHMENT_FIELDS) {
      yield [field, reference[field] ?? []]
    }
  }
}

function significanceValue(proposed) {
  // Keep the merged editors' category precedence, including an explicit clear.
  return createdStrategicSignificance(
    proposed.strategicSignificanceCategory ??
      proposed.strategicSignificance ??
      ''
  )
}
