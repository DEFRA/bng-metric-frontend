import { HEDGEROWS_TAB_ANCHOR } from './constants.js'
import {
  buildSectionsViewOnlyBaseFields,
  buildSharedPiViewOnlyFields,
  EMPTY_PLACEHOLDER,
  formatLengthDisplay
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
    ...buildSectionsViewOnlyBaseFields(feature, shared, proposed),
    sizeDisplay: formatLengthDisplay(feature.sizeMetres),
    habitatTypeDisplay: proposed.type ?? EMPTY_PLACEHOLDER
  }
}
