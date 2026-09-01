const SIGNIFICANT_FIGURES = 15
const DECIMAL_PLACES = 2
const NET_GAIN_TARGET_PERCENTAGE = 10
const NO_POST_INTERVENTION_PERCENTAGE = -100
const NOT_APPLICABLE = 'Not applicable'
const DEFAULT_BASELINE_ACTION_TEXT = 'View on-site baseline'
const AREA_BASELINE_ACTION_TEXT = 'View on-site area baseline'
const PERCENTAGE_DIVISOR = 100
const MIN_UNIT_DEFICIT = 0

function areaBaselineAction(href) {
  const action = { text: AREA_BASELINE_ACTION_TEXT }

  if (href) {
    action.href = href
  }

  return action
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
  return formatted === '-0.00' ? '0.00' : formatted
}

function formatOptionalUnits(value) {
  return isFiniteNumber(value) ? `${formatUnits(value)} units` : 'N/A'
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

function percentageSummary(value) {
  if (!isFiniteNumber(value)) {
    return { netPercentageChange: 'N/A', status: null }
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
      : '0.00 units',
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
  isFiniteNumber,
  normaliseUnits,
  percentageSummary
}
