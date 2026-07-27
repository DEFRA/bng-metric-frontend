import { formatAreaHectares } from '../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import {
  AREAS_TAB_ANCHOR,
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

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`
  }
  return EMPTY_PLACEHOLDER
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function displayText(value) {
  if (typeof value === 'string') {
    if (value === '') {
      return EMPTY_PLACEHOLDER
    } else {
      return value
    }
  }
  return formatFiniteNumber(value)
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatStandardTimeToTarget(value) {
  const years = displayText(value)
  if (years) {
    return `${STANDARD_TIME_TO_TARGET_PREFIX}${years}${STANDARD_TIME_TO_TARGET_SUFFIX}`
  } else {
    return EMPTY_PLACEHOLDER
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatDifficultyMultiplier(value) {
  return formatFiniteNumber(value)
}

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
    appliedDifficultyMultiplierDisplay: formatDifficultyMultiplier(
      proposed.difficultyMultiplier
    )
  }
}
