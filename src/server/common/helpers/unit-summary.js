import { HEDGEROWS_TOTAL_KEY, WATERCOURSES_TOTAL_KEY } from '../constants.js'

const SIGNIFICANT_FIGURES = 15
const DECIMAL_PLACES = 2
const ZERO_UNITS_DISPLAY = '0.00'
const NEGATIVE_ZERO_UNITS_DISPLAY = '-0.00'
const NET_GAIN_TARGET_PERCENTAGE = 10
const NO_POST_INTERVENTION_PERCENTAGE = -100
const NOT_AVAILABLE = 'N/A'
const NOT_APPLICABLE = 'Not applicable'
const DEFAULT_BASELINE_ACTION_TEXT = 'View on-site baseline'
const AREA_BASELINE_ACTION_TEXT = 'View on-site area baseline'
const HEDGEROWS_BASELINE_ACTION_TEXT = 'View on-site hedgerows baseline'
const WATERCOURSES_BASELINE_ACTION_TEXT = 'View on-site watercourses baseline'
const PERCENTAGE_DIVISOR = 100
const MIN_UNIT_DEFICIT = 0

function createBaselineAction(text, href) {
  const action = { text }

  if (href) {
    action.href = href
  }

  return action
}

function areaBaselineAction(href) {
  return createBaselineAction(AREA_BASELINE_ACTION_TEXT, href)
}

function hedgerowsBaselineAction(href) {
  return createBaselineAction(HEDGEROWS_BASELINE_ACTION_TEXT, href)
}

function watercoursesBaselineAction(href) {
  return createBaselineAction(WATERCOURSES_BASELINE_ACTION_TEXT, href)
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function normaliseUnits(value) {
  return isFiniteNumber(value) ? value : 0
}

function formatUnits(value) {
  const normalised = normaliseUnits(value)
  const rounded = Number(normalised.toPrecision(SIGNIFICANT_FIGURES))
  const formatted = rounded.toFixed(DECIMAL_PLACES)
  return formatted === NEGATIVE_ZERO_UNITS_DISPLAY
    ? ZERO_UNITS_DISPLAY
    : formatted
}

function formatOptionalUnits(value) {
  return isFiniteNumber(value) ? `${formatUnits(value)} units` : NOT_AVAILABLE
}

function areaUnits(units, missingValue = 0) {
  const habitatsTotal = units?.habitatsTotal
  const treesTotal = units?.treesTotal

  if (!isFiniteNumber(habitatsTotal) && !isFiniteNumber(treesTotal)) {
    return missingValue
  }

  return normaliseUnits(habitatsTotal) + normaliseUnits(treesTotal)
}

function areaInterventionSummary(units) {
  return {
    units: areaUnits(units, null),
    netUnitChange: units?.habitatsNetUnitChange,
    netPercentageChange: units?.habitatsNetUnitChangePercentage
  }
}

function hedgerowsInterventionSummary(units) {
  return {
    units: units?.[HEDGEROWS_TOTAL_KEY],
    netUnitChange: units?.hedgerowsNetUnitChange,
    netPercentageChange: units?.hedgerowsNetUnitChangePercentage
  }
}

function watercoursesInterventionSummary(units) {
  return {
    units: units?.[WATERCOURSES_TOTAL_KEY],
    netUnitChange: units?.watercoursesNetUnitChange,
    netPercentageChange: units?.watercoursesNetUnitChangePercentage
  }
}

function percentageSummary(value) {
  if (!isFiniteNumber(value)) {
    return { netPercentageChange: NOT_AVAILABLE, status: null }
  }

  const formattedPercentage = formatUnits(value)
  const targetMet = Number(formattedPercentage) >= NET_GAIN_TARGET_PERCENTAGE

  return {
    netPercentageChange: `${formattedPercentage}%`,
    status: {
      text: targetMet ? 'Met' : 'Not met',
      classes: targetMet ? 'govuk-tag--green' : 'govuk-tag--red'
    }
  }
}

function buildPostInterventionSummary(
  intervention,
  uploadHref,
  postInterventionOnly
) {
  const hasStandardIntervention = Boolean(intervention) && !postInterventionOnly

  return {
    heading: hasStandardIntervention
      ? 'On-site post-intervention'
      : 'On-site post intervention',
    units: intervention
      ? formatOptionalUnits(intervention.units)
      : `${ZERO_UNITS_DISPLAY} units`,
    action: hasStandardIntervention
      ? { text: 'View on-site post intervention' }
      : {
          text: 'Upload on-site post intervention file',
          href: uploadHref
        }
  }
}

function buildTargetsSummary(baselineUnits, postInterventionUnits) {
  const unitsRequired =
    baselineUnits * (1 + NET_GAIN_TARGET_PERCENTAGE / PERCENTAGE_DIVISOR)
  const unitDeficit = isFiniteNumber(postInterventionUnits)
    ? Math.max(MIN_UNIT_DEFICIT, unitsRequired - postInterventionUnits)
    : null

  return {
    targetPercentage: { text: `${NET_GAIN_TARGET_PERCENTAGE}%` },
    unitsRequired: `${formatUnits(unitsRequired)} units`,
    unitDeficit: formatOptionalUnits(unitDeficit)
  }
}

function buildUnitSummary({
  label,
  baselineUnits,
  uploadHref,
  intervention,
  headingHref,
  postInterventionOnly = false,
  baselineAction
}) {
  const normalisedBaseline = normaliseUnits(baselineUnits)
  const hasIntervention = Boolean(intervention)
  let percentage =
    normalisedBaseline > 0 ? NO_POST_INTERVENTION_PERCENTAGE : null
  let netUnitChange = -normalisedBaseline

  if (hasIntervention) {
    percentage = intervention.netPercentageChange
    netUnitChange = intervention.netUnitChange
  }

  const percentageSummaryDisplay = postInterventionOnly
    ? { netPercentageChange: NOT_APPLICABLE, status: null }
    : percentageSummary(percentage)

  return {
    id: label.toLowerCase().replaceAll(' ', '-'),
    label,
    headingHref,
    ...percentageSummaryDisplay,
    tradingRules: { text: 'View trading rules' },
    baseline: {
      units: `${formatUnits(normalisedBaseline)} units`,
      action: postInterventionOnly
        ? null
        : (baselineAction ?? { text: DEFAULT_BASELINE_ACTION_TEXT })
    },
    postIntervention: buildPostInterventionSummary(
      intervention,
      uploadHref,
      postInterventionOnly
    ),
    netUnitChange: hasIntervention
      ? formatOptionalUnits(netUnitChange)
      : `${formatUnits(netUnitChange)} units`
  }
}

export {
  NET_GAIN_TARGET_PERCENTAGE,
  NO_POST_INTERVENTION_PERCENTAGE,
  areaBaselineAction,
  areaInterventionSummary,
  areaUnits,
  buildTargetsSummary,
  buildUnitSummary,
  formatOptionalUnits,
  formatUnits,
  hedgerowsBaselineAction,
  hedgerowsInterventionSummary,
  isFiniteNumber,
  normaliseUnits,
  percentageSummary,
  watercoursesBaselineAction,
  watercoursesInterventionSummary
}
