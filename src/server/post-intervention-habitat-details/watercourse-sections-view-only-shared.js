import { WATERCOURSES_TAB_ANCHOR } from './constants.js'
import {
  buildSectionsViewOnlyBaseFields,
  buildSharedPiViewOnlyFields,
  EMPTY_PLACEHOLDER,
  formatLengthDisplay,
  withMultiplier
} from './view-only-shared.js'

/**
 * Shared two-section display fields for Created and Enhanced watercourses.
 *
 * Unlike the retained watercourse page, encroachment values are read straight
 * from `proposed` — the engine's calculation takes its encroachment inputs from
 * the proposed side, not the baseline side (see
 * `resolveWatercourseEnhancementMultipliers`'s caller in
 * enrich-post-intervention-watercourse.js).
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildWatercourseSectionsViewOnlyFields(
  feature,
  { projectId, projectName, baselineFeatureId }
) {
  const proposed = feature.proposed ?? {}
  const shared = buildSharedPiViewOnlyFields(feature, {
    projectId,
    projectName,
    baselineFeatureId,
    listTabAnchor: WATERCOURSES_TAB_ANCHOR
  })

  return {
    ...buildSectionsViewOnlyBaseFields(feature, shared, proposed),
    sizeDisplay: formatLengthDisplay(feature.sizeMetres),
    habitatTypeDisplay: proposed.type ?? EMPTY_PLACEHOLDER,
    watercourseEncroachmentDisplay: withMultiplier(
      proposed.watercourseEncroachment ?? EMPTY_PLACEHOLDER,
      proposed.waterEncroachmentMultiplier
    ),
    riparianEncroachmentDisplay: withMultiplier(
      proposed.riparianEncroachment ?? EMPTY_PLACEHOLDER,
      proposed.riparianEncroachmentMultiplier
    )
  }
}
