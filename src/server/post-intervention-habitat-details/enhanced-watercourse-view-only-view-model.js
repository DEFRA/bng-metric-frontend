import { buildWatercourseSectionsViewOnlyFields } from './watercourse-sections-view-only-shared.js'

/**
 * Build the read-only view model for an Enhanced post-intervention watercourse.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildEnhancedWatercourseViewOnlyViewModel(feature, ctx) {
  return buildWatercourseSectionsViewOnlyFields(feature, ctx)
}
