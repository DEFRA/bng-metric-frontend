// The edit kinds an individual tree's post-intervention details page uses: a
// Created tree's and an Enhanced tree's (CREATED_EDIT_KINDS in
// created-area-edit.js), and how an Enhanced tree's choices are narrowed to it.

import {
  loadCreatedTreeReference,
  loadEnhancedTreeReference
} from './created-edit-reference.js'
import { buildTreeSectionsViewOnlyViewModel } from './tree-view-only-view-model.js'
import { INDIVIDUAL_TREES_BROAD_HABITAT } from '../baseline-habitat-details/strategies/tree.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { formatAreaHectaresValue } from '../common/helpers/format-habitat-values.js'
import { formErrorText } from '../common/error-text/error-text.js'
import { AREA_SECTIONS_TEMPLATE, AREA_SIZE_LABEL } from './constants.js'

// What a Created and an Enhanced tree are edited with alike. A tree stays a
// tree: its broad habitat is always Individual trees, shown and sent but not
// editable, and its habitat type must be Urban tree or Rural tree. Its size
// class and number of trees are shown, not edited. Until the backend serves
// its reference, it keeps its read-only page.
const TREE_KIND_BASE = Object.freeze({
  label: 'Tree',
  optionalReference: true,
  readOnlyTemplate: AREA_SECTIONS_TEMPLATE,
  buildBase: buildTreeSectionsViewOnlyViewModel,
  formatSize: (feature) => formatAreaHectaresValue(feature.sizeSquareMetres),
  sizeLabel: AREA_SIZE_LABEL,
  backType: 'tree',
  savePath: 'trees',
  hasBroadHabitat: true,
  fixedBroadHabitat: INDIVIDUAL_TREES_BROAD_HABITAT,
  habitatTypeRequired: true,
  habitatTypeError: Object.freeze(formErrorText('habitatType', 'invalidTree'))
})

/** A Created individual tree, edited as a Created area habitat is. */
export const CREATED_TREE_KIND = Object.freeze({
  ...TREE_KIND_BASE,
  loadReference: loadCreatedTreeReference
})

/**
 * An Enhanced tree's setting: its proposed one, or, where its file left that
 * blank, its baseline one, as the service reads it.
 *
 * @param {object} feature the post-intervention tree
 * @returns {string | null}
 */
function enhancedTreeSetting(feature) {
  return feature.proposed?.type ?? feature.baseline?.type ?? null
}

/**
 * The Enhanced tree with its setting filled in where its file left it blank,
 * so the page selects, offers and saves the setting the backend reads.
 *
 * @param {object} feature the post-intervention tree
 * @returns {object}
 */
export function withEnhancedTreeSetting(feature) {
  if (feature.proposed?.type) {
    return feature
  }
  return {
    ...feature,
    proposed: { ...feature.proposed, type: enhancedTreeSetting(feature) }
  }
}

/**
 * The target conditions an Enhanced tree is offered. One whose baseline
 * condition the Metric scores is offered the better ones. One whose baseline
 * condition it does not, such as a blank one or "N/A" on a legacy upload, is
 * not checked by the service (checkTreeEnhancement), so it keeps its stored
 * target condition as its only choice, with no time to target shown, and can
 * still be saved.
 *
 * @param {object} type a habitat type of the enhancement reference
 * @param {object} feature the post-intervention tree
 * @returns {Array<{ condition: string, score: number, years?: number | string }>}
 */
function enhancedTreeConditions(type, feature) {
  const baselineCondition = stripConditionPrefix(feature.baseline?.condition)
  if (Object.hasOwn(type.enhancements ?? {}, baselineCondition)) {
    return type.enhancements[baselineCondition]
  }
  const stored = stripConditionPrefix(feature.proposed?.condition)
  return stored
    ? [{ condition: stored, score: feature.proposed?.conditionScore ?? '' }]
    : []
}

/**
 * The tree enhancement reference narrowed to one Enhanced tree: only its own
 * habitat type, as its setting is its baseline tree's, offering only the
 * target conditions its baseline condition can be enhanced to. Each type
 * keeps its `enhancements`, so narrowing an already narrowed reference gives
 * the same choices.
 *
 * @param {object} reference from loadEnhancedTreeReference
 * @param {object} feature the post-intervention tree
 * @returns {object}
 */
export function enhancedTreeReference(reference, feature) {
  const setting = enhancedTreeSetting(feature)
  return {
    ...reference,
    habitatTypes: reference.habitatTypes
      .filter((type) => type.name === setting)
      .map((type) => ({
        ...type,
        conditions: enhancedTreeConditions(type, feature)
      }))
  }
}

/**
 * An Enhanced individual tree, edited on the Created tree's page. It enhances
 * its condition only: its size, type and setting are its baseline tree's. So
 * its habitat type is offered only as stored, and its target condition only
 * as one better than its baseline condition, with the Metric's enhancement
 * time to target (enhancedTreeReference).
 */
export const ENHANCED_TREE_KIND = Object.freeze({
  ...TREE_KIND_BASE,
  loadReference: loadEnhancedTreeReference,
  conditionError: Object.freeze(
    formErrorText('condition', 'notBetterThanBaseline')
  ),
  timingLabels: Object.freeze({
    advanceYears: 'Habitat enhanced in advance (years)',
    delayYears: 'Delay in starting habitat enhancement (years)'
  }),
  forFeature: enhancedTreeReference,
  normaliseFeature: withEnhancedTreeSetting
})
