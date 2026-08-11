// Shared building blocks for the read-only post-intervention details pages
// (areas, hedgerows and watercourses).
//
// The three pages show the same values apart from their size row and one or two
// habitat-specific rows, so the fields they share are built here once and each
// habitat type contributes only its own slice (see the *-view-only-view-model
// modules). The rows themselves stay in the per-habitat templates, which extend
// layouts/pi-view-only-page.njk for the shared page chrome.

import {
  formatHabitatUnits,
  formatLengthKm,
  KM_UNIT
} from '../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import {
  HABITAT_UNITS_DELIVERED_LABEL,
  PI_DETAILS_HEADING,
  STANDARD_TIME_TO_TARGET_SUFFIX,
  TIME_DIFFICULTY_SECTION_HEADING
} from './constants.js'
import { interventionDisplay } from './retention.js'

// Strategic significance is fixed at Low (1) in MVS across every habitat type,
// matching the baseline details pages. The variable significance multipliers
// come later.
export const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'

export const EMPTY_PLACEHOLDER = ''

/**
 * Render a value with its multiplier in brackets ("Low (2)"), or just the value
 * when the score is absent, or an empty cell when there is no value.
 *
 * @param {string|null|undefined} value
 * @param {number|null|undefined} score
 * @returns {string}
 */
export function withMultiplier(value, score) {
  if (value) {
    if (typeof score === 'number') {
      return `${value} (${score})`
    } else {
      return value
    }
  } else {
    return ''
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`
  }
  return EMPTY_PLACEHOLDER
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function displayText(value) {
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
 * @param {unknown} baselineCondition
 * @param {unknown} targetCondition
 * @param {unknown} value
 * @returns {string}
 */
export function formatStandardTimeToTarget(
  baselineCondition,
  targetCondition,
  value
) {
  const baselineValue = stripConditionPrefix(displayText(baselineCondition))
  const targetValue = stripConditionPrefix(displayText(targetCondition))
  const baseline =
    typeof baselineValue === 'string' ? baselineValue : EMPTY_PLACEHOLDER
  const target =
    typeof targetValue === 'string' ? targetValue : EMPTY_PLACEHOLDER
  const years = displayText(value)
  if (!target || !years) {
    return EMPTY_PLACEHOLDER
  }
  const conditionTransition = baseline ? `${baseline} to ${target}` : target
  return `${conditionTransition} - ${years}${STANDARD_TIME_TO_TARGET_SUFFIX}`
}

/**
 * @param {number|null|undefined} sizeMetres
 * @returns {string}
 */
export function formatLengthDisplay(sizeMetres) {
  const length = formatLengthKm(sizeMetres)
  if (length === EMPTY_PLACEHOLDER) {
    return EMPTY_PLACEHOLDER
  } else {
    return `${length}${KM_UNIT}`
  }
}

/**
 * Chrome and time/difficulty rows shared by Created/Enhanced two-section pages.
 *
 * @param {object} feature
 * @param {object} shared fields from buildSharedPiViewOnlyFields
 * @param {object} proposed feature.proposed (or {})
 * @returns {object}
 */
export function buildSectionsViewOnlyBaseFields(feature, shared, proposed) {
  const baseline = feature.baseline ?? {}
  return {
    ...shared,
    heading: feature.ref ?? EMPTY_PLACEHOLDER,
    pageTitle: feature.ref ?? PI_DETAILS_HEADING,
    habitatDetailsSectionHeading: PI_DETAILS_HEADING,
    timeDifficultySectionHeading: TIME_DIFFICULTY_SECTION_HEADING,
    habitatUnitsLabel: HABITAT_UNITS_DELIVERED_LABEL,
    targetConditionDisplay: withMultiplier(
      stripConditionPrefix(proposed.condition),
      proposed.conditionScore
    ),
    standardTimeToTargetDisplay: formatStandardTimeToTarget(
      baseline.condition,
      proposed.condition,
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
 * Build the "View baseline details" href for a post-intervention feature.
 * Baseline and post-intervention are separate uploads, so a parcel gets a
 * different featureId in each document; the baseline feature is resolved by ref
 * by the caller and passed in here. Null means no matching baseline feature
 * (e.g. no baseline uploaded), in which case the link is hidden.
 *
 * @param {string|null} baselineFeatureId
 * @param {string} projectId
 * @returns {string|null}
 */
export function baselineDetailsHref(baselineFeatureId, projectId) {
  if (baselineFeatureId) {
    const params = new URLSearchParams({
      featureId: baselineFeatureId,
      projectId
    })
    return `/baseline-habitat-details?${params.toString()}`
  } else {
    return null
  }
}

/**
 * Fields shared by the area and hedgerow read-only post-intervention pages.
 *
 * @param {object} feature
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null, listTabAnchor: string }} ctx
 * @returns {object}
 */
export function buildSharedPiViewOnlyFields(
  feature,
  { projectId, projectName, baselineFeatureId, listTabAnchor }
) {
  const proposed = feature.proposed ?? {}
  return {
    pageTitle: PI_DETAILS_HEADING,
    heading: PI_DETAILS_HEADING,
    caption: projectName,
    habitatRef: feature.ref ?? '',
    interventionDisplay: interventionDisplay(feature.retentionCategory),
    distinctivenessDisplay: withMultiplier(
      proposed.distinctiveness,
      proposed.distinctivenessScore
    ),
    conditionDisplay: withMultiplier(
      stripConditionPrefix(proposed.condition),
      proposed.conditionScore
    ),
    strategicSignificanceDisplay: FIXED_STRATEGIC_SIGNIFICANCE,
    habitatUnitsDisplay: formatHabitatUnits(feature.units),
    viewBaselineHref: baselineDetailsHref(baselineFeatureId, projectId),
    backHref: `/projects/${projectId}/post-intervention-habitat-list${listTabAnchor}`
  }
}

/**
 * Build the read-only view model for a retained post-intervention feature.
 *
 * These pages are only reached for retained features, and for a retained
 * feature the engine derives every score and multiplier from the *baseline*
 * side (see the backend's buildRetained*Calculate, which feed it
 * `baseline.type`, the baseline condition and the baseline encroachments). The
 * uploaded `proposed` columns are not the engine's input and for a retained
 * parcel are frequently blank. So descriptive values (habitat type, condition,
 * encroachment) are read from `baseline` first and fall back to `proposed`,
 * while the derived scores and multipliers are read from `proposed`, which is
 * where the backend writes them. That keeps every value next to the multiplier
 * that was actually computed from it.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @param {object} spec the habitat-type-specific slice of the page
 * @returns {object}
 */
export function buildViewOnlyViewModel(
  feature,
  { projectId, projectName, baselineFeatureId },
  spec
) {
  const proposed = feature.proposed ?? {}
  const baseline = feature.baseline ?? {}
  // The descriptive values the engine took from the baseline for a retained
  // feature; `proposed` is only a fallback for features with no baseline side.
  const retained = (key) => baseline[key] ?? proposed[key] ?? ''

  return {
    pageTitle: PI_DETAILS_HEADING,
    heading: PI_DETAILS_HEADING,
    caption: projectName,
    habitatRef: feature.ref ?? '',
    interventionDisplay: interventionDisplay(feature.retentionCategory),
    sizeDisplay: spec.formatSize(feature),
    habitatTypeDisplay: retained('type'),
    distinctivenessDisplay: withMultiplier(
      proposed.distinctiveness,
      proposed.distinctivenessScore
    ),
    conditionDisplay: withMultiplier(
      stripConditionPrefix(retained('condition')),
      proposed.conditionScore
    ),
    strategicSignificanceDisplay: FIXED_STRATEGIC_SIGNIFICANCE,
    habitatUnitsDisplay: formatHabitatUnits(feature.units),
    viewBaselineHref: baselineDetailsHref(baselineFeatureId, projectId),
    backHref: `/projects/${projectId}/post-intervention-habitat-list${spec.tabAnchor}`,
    ...(spec.extraFields?.({ feature, baseline, proposed, retained }) ?? {})
  }
}
