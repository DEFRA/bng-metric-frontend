import {
  RETENTION_CREATED,
  RETENTION_ENHANCED,
  RETENTION_RETAINED
} from '../../post-intervention-habitat-details/retention.js'
import { formatHabitatUnits } from './format-habitat-values.js'
import { HABITAT_UPLOAD_TYPES } from './habitat-upload-types.js'
import {
  EMPTY_DISPLAY,
  FIXED_STRATEGIC_SIGNIFICANCE,
  TOTALS_LABEL,
  boldCell,
  buildHabitatGrid,
  buildRefCell,
  formatLabelAndScore,
  numericCell,
  textCell
} from './habitat-grid.js'
import { isFiniteNumber } from './unit-summary.js'
import { stripConditionPrefix } from './strip-condition-prefix.js'

const HABITATS_WORD = 'habitats'
const YEAR_SINGULAR = 1
const YEAR_LABEL_SINGULAR = 'year'
const YEAR_LABEL_PLURAL = 'years'
const INTERVENTION_WITH_CONDITION = RETENTION_RETAINED
const INTERVENTION_WITH_TARGET_FIELDS = new Set([
  RETENTION_ENHANCED,
  RETENTION_CREATED
])

function proposedOf(feature) {
  return feature?.proposed ?? {}
}

function proposedValue(feature, key) {
  const nested = proposedOf(feature)[key]
  if (nested != null && nested !== EMPTY_DISPLAY) {
    return nested
  }
  return feature?.[key]
}

function bandLabel(value) {
  if (value && typeof value === 'object' && typeof value.level === 'string') {
    return value.level
  }
  if (typeof value === 'string') {
    return stripConditionPrefix(value) ?? EMPTY_DISPLAY
  }
  return value
}

function yearsPhrase(years) {
  const unit = years === YEAR_SINGULAR ? YEAR_LABEL_SINGULAR : YEAR_LABEL_PLURAL
  return `${years} ${unit}`
}

function parseYears(value) {
  if (isFiniteNumber(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== EMPTY_DISPLAY) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function formatYears(value) {
  const years = parseYears(value)
  if (years === null) {
    return EMPTY_DISPLAY
  }
  return yearsPhrase(years)
}

function formatFinalTimeToTarget(proposed) {
  const existing = proposed.finalTimeToTargetCondition
  if (typeof existing === 'string' && existing.trim() !== EMPTY_DISPLAY) {
    return existing.trim()
  }

  const years = formatYears(existing)
  if (!years) {
    return EMPTY_DISPLAY
  }

  return formatLabelAndScore(years, proposed.timeMultiplier)
}

function sharedSizeColumns({ readSize, formatSize, formatSizeTotal }) {
  return [
    {
      text: 'Ref',
      cell: (feature, projectId) =>
        buildRefCell(
          feature,
          projectId,
          HABITAT_UPLOAD_TYPES.postIntervention.detailsRoute
        ),
      total: () => boldCell(textCell(TOTALS_LABEL))
    },
    {
      text: 'Units',
      numeric: true,
      cell: (feature) =>
        numericCell(formatHabitatUnits(feature.units), feature.units),
      total: (totals) => boldCell(numericCell(formatHabitatUnits(totals.units)))
    },
    {
      text: 'Size',
      numeric: true,
      cell: (feature) =>
        numericCell(formatSize(readSize(feature)), readSize(feature)),
      total: (totals) => boldCell(numericCell(formatSizeTotal(totals.size)))
    }
  ]
}

function habitatTypeAndDistinctivenessColumns() {
  return [
    {
      text: 'Habitat type',
      cell: (feature) => textCell(proposedValue(feature, 'type'))
    },
    {
      text: 'Distinctiveness',
      cell: (feature) =>
        textCell(
          formatLabelAndScore(
            bandLabel(proposedValue(feature, 'distinctiveness')),
            proposedValue(feature, 'distinctivenessScore')
          )
        )
    }
  ]
}

function conditionColumn() {
  return {
    text: 'Condition',
    cell: (feature) =>
      textCell(
        formatLabelAndScore(
          bandLabel(proposedValue(feature, 'condition')),
          proposedValue(feature, 'conditionScore')
        )
      )
  }
}

function strategicSignificanceColumn() {
  return {
    text: 'Strategic significance',
    cell: () => textCell(FIXED_STRATEGIC_SIGNIFICANCE)
  }
}

function targetAndTimeColumns() {
  return [
    {
      text: 'Target condition',
      cell: (feature) =>
        textCell(
          formatLabelAndScore(
            bandLabel(proposedValue(feature, 'condition')),
            proposedValue(feature, 'conditionScore')
          )
        )
    },
    {
      text: 'Standard time to target',
      cell: (feature) =>
        textCell(
          formatYears(proposedValue(feature, 'standardTimeToTargetCondition'))
        )
    },
    {
      text: 'Advance',
      cell: (feature) =>
        textCell(formatYears(proposedValue(feature, 'advanceYears')))
    },
    {
      text: 'Delay',
      cell: (feature) =>
        textCell(formatYears(proposedValue(feature, 'delayYears')))
    },
    {
      text: 'Final time to target',
      cell: (feature) => textCell(formatFinalTimeToTarget(proposedOf(feature)))
    },
    {
      text: 'Standard Difficulty',
      cell: (feature) =>
        textCell(
          formatLabelAndScore(
            bandLabel(proposedValue(feature, 'difficulty')),
            proposedValue(feature, 'difficultyMultiplier')
          )
        )
    }
  ]
}

function buildColumns({
  interventionType,
  readSize,
  formatSize,
  formatSizeTotal
}) {
  const columns = [
    ...sharedSizeColumns({ readSize, formatSize, formatSizeTotal }),
    ...habitatTypeAndDistinctivenessColumns()
  ]

  if (interventionType === INTERVENTION_WITH_CONDITION) {
    columns.push(conditionColumn())
  }

  columns.push(strategicSignificanceColumn())

  if (INTERVENTION_WITH_TARGET_FIELDS.has(interventionType)) {
    columns.push(...targetAndTimeColumns())
  }

  return columns
}

/**
 * Tab panel heading for a visible intervention type, e.g. "Created hedgerow habitats".
 *
 * @param {string} tabLabel
 * @param {string} habitatNoun
 * @returns {string}
 */
function habitatTabHeading(tabLabel, habitatNoun) {
  return `${tabLabel} ${habitatNoun} ${HABITATS_WORD}`
}

/**
 * Build the habitat-details grid for one post-intervention tab.
 *
 * @param {object} options
 * @param {object[]} options.features
 * @param {string} options.projectId
 * @param {string} options.interventionType Retained, Enhanced or Created
 * @param {(feature: object) => number|null|undefined} options.readSize
 * @param {(value: number|null|undefined) => string} options.formatSize
 * @param {(value: number|null|undefined) => string} options.formatSizeTotal
 */
function buildPostInterventionHabitatGrid({
  features,
  projectId,
  interventionType,
  readSize,
  formatSize,
  formatSizeTotal
}) {
  return buildHabitatGrid({
    columns: buildColumns({
      interventionType,
      readSize,
      formatSize,
      formatSizeTotal
    }),
    features,
    projectId,
    readSize
  })
}

export { buildPostInterventionHabitatGrid, formatYears, habitatTabHeading }
