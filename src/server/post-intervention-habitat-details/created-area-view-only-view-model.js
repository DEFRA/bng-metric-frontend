import { buildAreaSectionsViewOnlyFields } from './area-sections-view-only-shared.js'

/**
 * Build the read-only view model for a Created post-intervention area habitat.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildCreatedAreaViewOnlyViewModel(feature, ctx) {
  return buildAreaSectionsViewOnlyFields(feature, ctx)
}
