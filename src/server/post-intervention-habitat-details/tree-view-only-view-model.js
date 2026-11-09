import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'
import { buildAreaSectionsViewOnlyFields } from './area-sections-view-only-shared.js'
import { treeDetailsFields } from '../common/helpers/tree-details.js'

/**
 * The read-only view models for a post-intervention individual tree: an area
 * habitat's, with the tree's size class and the number of trees it stands
 * for, the values the surveyor entered. A Retained or Enhanced tree keeps its
 * baseline tree's size class, so its proposed side gives it in every case.
 */

/**
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildRetainedTreeViewOnlyViewModel(feature, ctx) {
  return {
    ...buildAreaViewOnlyViewModel(feature, ctx),
    ...treeDetailsFields(feature.proposed?.treeSize, feature.count)
  }
}

/**
 * Enhanced and Created trees: the two-section layout, with time to target and
 * difficulty.
 *
 * @param {object} feature
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildTreeSectionsViewOnlyViewModel(feature, ctx) {
  return {
    ...buildAreaSectionsViewOnlyFields(feature, ctx),
    ...treeDetailsFields(feature.proposed?.treeSize, feature.count)
  }
}
