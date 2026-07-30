import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import {
  HEDGEROWS_TAB_ANCHOR,
  HABITAT_UNITS_DELIVERED_LABEL,
  PI_DETAILS_HEADING,
  TIME_DIFFICULTY_SECTION_HEADING
} from './constants.js'
import {
  buildSharedPiViewOnlyFields,
  displayText,
  formatFiniteNumber,
  formatLengthDisplay,
  formatStandardTimeToTarget,
  withMultiplier
} from './view-only-shared.js'

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
