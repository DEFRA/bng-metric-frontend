import {
  formatLengthKm,
  KM_UNIT
} from '../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import {
  HEDGEROWS_TAB_ANCHOR,
  HABITAT_UNITS_DELIVERED_LABEL,
  PI_DETAILS_HEADING,
  STANDARD_TIME_TO_TARGET_PREFIX,
  STANDARD_TIME_TO_TARGET_SUFFIX,
  TIME_DIFFICULTY_SECTION_HEADING
} from './constants.js'
import {
  buildSharedPiViewOnlyFields,
  withMultiplier
} from './view-only-shared.js'

const EMPTY_PLACEHOLDER = ''

function formatFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value}`
    : EMPTY_PLACEHOLDER
}

function displayText(value) {
  if (typeof value === 'string') {
    return value
  }
  return formatFiniteNumber(value)
}

function formatStandardTimeToTarget(value) {
  const years = displayText(value)
  return years
    ? `${STANDARD_TIME_TO_TARGET_PREFIX}${years}${STANDARD_TIME_TO_TARGET_SUFFIX}`
    : EMPTY_PLACEHOLDER
}

function formatLengthDisplay(sizeMetres) {
  const length = formatLengthKm(sizeMetres)
  return length === EMPTY_PLACEHOLDER
    ? EMPTY_PLACEHOLDER
    : `${length}${KM_UNIT}`
}

/**
 * Build the two-section read-only view model for an Enhanced hedgerow.
 *
 * @param {object} feature
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildEnhancedHedgerowViewOnlyViewModel(
  feature,
  { projectId, projectName, baselineFeatureId }
) {
  const proposed = feature.proposed ?? {}
  const shared = buildSharedPiViewOnlyFields(feature, {
    projectId,
    projectName,
    baselineFeatureId,
    listTabAnchor: HEDGEROWS_TAB_ANCHOR
  })

  return {
    ...shared,
    heading: feature.ref ?? '',
    pageTitle: feature.ref ?? PI_DETAILS_HEADING,
    habitatDetailsSectionHeading: PI_DETAILS_HEADING,
    timeDifficultySectionHeading: TIME_DIFFICULTY_SECTION_HEADING,
    habitatUnitsLabel: HABITAT_UNITS_DELIVERED_LABEL,
    sizeDisplay: formatLengthDisplay(feature.sizeMetres),
    habitatTypeDisplay: proposed.type ?? '',
    targetConditionDisplay: withMultiplier(
      stripConditionPrefix(proposed.condition),
      proposed.conditionScore
    ),
    standardTimeToTargetDisplay: formatStandardTimeToTarget(
      proposed.standardTimeToTargetCondition
    ),
    standardDifficultyDisplay: displayText(proposed.difficulty),
    advanceOrDelayDisplay: displayText(proposed.advanceOrDelay),
    finalTimeToTargetDisplay: displayText(proposed.finalTimeToTargetCondition),
    appliedDifficultyMultiplierDisplay: formatFiniteNumber(
      proposed.difficultyMultiplier
    )
  }
}
/**
 * Build the two-section read-only view model for a Created hedgerow.
 * Created habitats have no baseline feature, so the baseline link is always
 * suppressed even if another feature happens to share the same reference.
 *
 * @param {object} feature
 * @param {{ projectId: string, projectName: string }} ctx
 * @returns {object}
 */
export function buildCreatedHedgerowViewOnlyViewModel(feature, ctx) {
  return buildEnhancedHedgerowViewOnlyViewModel(feature, {
    ...ctx,
    baselineFeatureId: null
  })
}
