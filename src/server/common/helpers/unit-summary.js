const SIGNIFICANT_FIGURES = 15
const DECIMAL_PLACES = 2
const NET_GAIN_TARGET_PERCENTAGE = 10
const NO_POST_INTERVENTION_PERCENTAGE = -100

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

function buildUnitSummary(
  label,
  baselineUnits,
  uploadHref,
  intervention,
  headingHref
) {
  const normalisedBaseline = normaliseUnits(baselineUnits)
  const hasIntervention = Boolean(intervention)
  let percentage =
    normalisedBaseline > 0 ? NO_POST_INTERVENTION_PERCENTAGE : null
  let netUnitChange = -normalisedBaseline

  if (hasIntervention) {
    percentage = intervention.netPercentageChange
    netUnitChange = intervention.netUnitChange
  }

  return {
    id: label.toLowerCase().replaceAll(' ', '-'),
    label,
    headingHref,
    ...percentageSummary(percentage),
    tradingRules: { text: 'View trading rules' },
    baseline: {
      units: `${formatUnits(normalisedBaseline)} units`,
      action: { text: 'View on-site baseline' }
    },
    postIntervention: {
      heading: hasIntervention
        ? 'On-site post-intervention'
        : 'On-site post intervention',
      units: hasIntervention
        ? formatOptionalUnits(intervention.units)
        : '0.00 units',
      action: hasIntervention
        ? { text: 'View on-site post intervention' }
        : {
            text: 'Upload on-site post intervention file',
            href: uploadHref
          }
    },
    netUnitChange: hasIntervention
      ? formatOptionalUnits(netUnitChange)
      : `${formatUnits(netUnitChange)} units`
  }
}

export {
  NET_GAIN_TARGET_PERCENTAGE,
  NO_POST_INTERVENTION_PERCENTAGE,
  areaUnits,
  buildUnitSummary,
  formatOptionalUnits,
  formatUnits,
  isFiniteNumber,
  normaliseUnits,
  percentageSummary
}
