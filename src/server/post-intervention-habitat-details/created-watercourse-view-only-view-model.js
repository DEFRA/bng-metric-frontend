import { buildWatercourseSectionsViewOnlyFields } from './watercourse-sections-view-only-shared.js'

/**
 * Build the read-only view model for a Created post-intervention watercourse.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildCreatedWatercourseViewOnlyViewModel(feature, ctx) {
  return buildWatercourseSectionsViewOnlyFields(feature, ctx)
}
