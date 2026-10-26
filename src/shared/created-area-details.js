// Shared by the server render and browser preview. Units are only recalculated
// by the backend on Save, using the metric engine.
export const MAX_YEARS = 30
export const YEAR_OPTIONS = [
  ...Array.from({ length: MAX_YEARS + 1 }, (_, year) => String(year)),
  '30+'
]

export function selectedHabitat(reference, values) {
  return reference.habitatTypes.find(
    (type) =>
      type.broad === values.broadHabitat && type.name === values.habitatType
  )
}

export function createdAreaDerived(reference, values) {
  const type = selectedHabitat(reference, values)
  const condition = type?.conditions.find(
    (c) => c.condition === values.condition
  )
  const result = {
    distinctivenessDisplay: type
      ? `${type.distinctiveness} (${type.distinctivenessScore})`
      : '',
    standardDifficultyDisplay: type?.difficulty ?? '',
    appliedDifficultyMultiplierDisplay: String(
      type?.difficultyMultiplier ?? ''
    ),
    standardTimeToTargetDisplay: condition
      ? `${condition.condition} - ${condition.years} years`
      : '',
    finalTimeToTargetDisplay: ''
  }
  const { advanceYears, delayYears } = values
  if (
    !condition ||
    !YEAR_OPTIONS.includes(advanceYears) ||
    !YEAR_OPTIONS.includes(delayYears) ||
    (Number.parseInt(advanceYears) > 0 && Number.parseInt(delayYears) > 0)
  ) {
    return result
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
    result.finalTimeToTargetDisplay = `${key} years (${multiplier})`
  }
  return result
}
