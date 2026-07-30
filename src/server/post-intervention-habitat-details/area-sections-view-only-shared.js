import { formatAreaHectares } from '../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import {
  AREAS_TAB_ANCHOR,
  HABITAT_UNITS_DELIVERED_LABEL,
  PI_DETAILS_HEADING,
  TIME_DIFFICULTY_SECTION_HEADING
} from './constants.js'
import {
  buildSharedPiViewOnlyFields,
  displayText,
  formatFiniteNumber,
  formatStandardTimeToTarget,
  withMultiplier
} from './view-only-shared.js'

const EMPTY_PLACEHOLDER = ''

/**
 * Shared two-section display fields for Created and Enhanced area habitats.
 * Heading uses the parcel ref; time/difficulty rows come from `proposed`.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildAreaSectionsViewOnlyFields(
  feature,
  { projectId, projectName, baselineFeatureId }
) {
  const proposed = feature.proposed ?? {}
  const shared = buildSharedPiViewOnlyFields(feature, {
    projectId,
    projectName,
    baselineFeatureId,
    listTabAnchor: AREAS_TAB_ANCHOR
  })

  return {
    ...shared,
    // Ref is the page heading; project name stays the caption.
    heading: feature.ref ?? EMPTY_PLACEHOLDER,
    pageTitle: feature.ref ?? PI_DETAILS_HEADING,
    habitatDetailsSectionHeading: PI_DETAILS_HEADING,
    timeDifficultySectionHeading: TIME_DIFFICULTY_SECTION_HEADING,
    habitatUnitsLabel: HABITAT_UNITS_DELIVERED_LABEL,
    sizeDisplay: formatAreaHectares(feature.sizeSquareMetres),
    broadHabitatDisplay: proposed.broadType ?? EMPTY_PLACEHOLDER,
    habitatTypeDisplay: proposed.type ?? EMPTY_PLACEHOLDER,
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
