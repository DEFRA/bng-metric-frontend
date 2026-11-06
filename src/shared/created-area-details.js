// Shared by the server render and browser preview. Units are only recalculated
// by the backend on Save, using the metric engine.
export const UNCHANGED_VALUE = 'unchanged'
export const MAX_YEARS = 30
export const YEAR_OPTIONS = [
  ...Array.from({ length: MAX_YEARS + 1 }, (_, year) => String(year)),
  '30+'
]

const TYPE_INPUTS = ['broadHabitat', 'habitatType']
const CONDITION_INPUTS = [...TYPE_INPUTS, 'condition']
export const CREATED_DERIVED_INPUTS = {
  distinctivenessDisplay: TYPE_INPUTS,
  standardDifficultyDisplay: TYPE_INPUTS,
  appliedDifficultyMultiplierDisplay: TYPE_INPUTS,
  standardTimeToTargetDisplay: CONDITION_INPUTS,
  finalTimeToTargetDisplay: [...CONDITION_INPUTS, 'advanceYears', 'delayYears']
}

export function createdDerivedInputsUnchanged(display, values, originalValues) {
  return CREATED_DERIVED_INPUTS[display].every(
    (input) => (values[input] ?? '') === (originalValues[input] ?? '')
  )
}

export function resolveCreatedTiming(values, reference) {
  return Object.fromEntries(
    ['advanceYears', 'delayYears'].map((field) => [
      field,
      values[field] === UNCHANGED_VALUE
        ? (reference.importedYears?.[field] ?? '')
        : values[field]
    ])
  )
}

export function selectedHabitat(reference, values) {
  return reference.habitatTypes.find(
    (type) =>
      (reference.hasBroadHabitat === false ||
        type.broad === values.broadHabitat) &&
      type.name === values.habitatType
  )
}

export function createdAreaDerived(reference, values, baselineCondition = '') {
  const type = selectedHabitat(reference, values)
  const condition = type?.conditions.find(
    (c) => c.condition === values.condition
  )
  return {
    ...standardFields(type, condition, baselineCondition),
    finalTimeToTargetDisplay:
      finalTimeDisplay(reference, condition, values) ||
      unchangedImportedFinalTime(reference, values)
  }
}

function standardFields(type, condition, baselineCondition) {
  const baselinePrefix =
    baselineCondition && !baselineCondition.startsWith('N/A')
      ? `${baselineCondition} to `
      : ''
  return {
    distinctivenessDisplay: type
      ? `${type.distinctiveness} (${type.distinctivenessScore})`
      : '',
    standardDifficultyDisplay: type?.difficulty ?? '',
    appliedDifficultyMultiplierDisplay: String(
      type?.difficultyMultiplier ?? ''
    ),
    standardTimeToTargetDisplay: condition
      ? `${baselinePrefix}${condition.condition} - ${condition.years} years`
      : ''
  }
}

function finalTimeDisplay(reference, condition, values) {
  const { advanceYears, delayYears } = values
  if (
    !condition ||
    !YEAR_OPTIONS.includes(advanceYears) ||
    !YEAR_OPTIONS.includes(delayYears) ||
    (Number.parseInt(advanceYears) > 0 && Number.parseInt(delayYears) > 0)
  ) {
    return ''
  }
  // The metric engine accepts 30+ as a legacy alias for 30 input years.
  const years = (value) =>
    ['30+', '>30'].includes(value) ? MAX_YEARS : Number(value)
  const finalYears = Math.max(
    0,
    years(String(condition.years)) + years(delayYears) - years(advanceYears)
  )
  const overMaxStandard = ['30+', '>30'].includes(String(condition.years))
  const key =
    finalYears > MAX_YEARS || (overMaxStandard && years(advanceYears) === 0)
      ? '30+'
      : String(finalYears)
  const multiplier = reference.timeMultipliers[key]
  if (typeof multiplier === 'number') {
    return `${key} years (${multiplier})`
  }
  return ''
}

function unchangedImportedFinalTime(reference, values) {
  const timing = resolveCreatedTiming(values, reference)
  if (
    Number.parseFloat(timing.advanceYears) > 0 &&
    Number.parseFloat(timing.delayYears) > 0
  ) {
    return ''
  }
  const saved = reference.importedCalculation
  const fields = [
    'broadHabitat',
    'habitatType',
    'condition',
    'advanceYears',
    'delayYears'
  ]
  if (
    values.habitatType === UNCHANGED_VALUE ||
    (!Object.keys(reference.importedYears ?? {}).length &&
      !reference.importedCondition) ||
    !saved
  ) {
    return ''
  }
  return fields.every(
    (field) => (values[field] ?? '') === (saved.values[field] ?? '')
  )
    ? saved.finalTimeToTargetDisplay
    : ''
}
