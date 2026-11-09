import { isFiniteNumber } from './unit-summary.js'
import {
  featureRetentionCategory,
  RETENTION_CREATED
} from '../../post-intervention-habitat-details/retention.js'

// BMD-1048 AC2 and AC11: an incomplete Created habitat shows zero units, on its
// list row as on its details page. Display only: the stored units, null after
// an import or zero after an edit save, are left unchanged.

export function needsCreatedZeroUnits(feature) {
  return (
    featureRetentionCategory(feature) === RETENTION_CREATED &&
    !isFiniteNumber(feature.units)
  )
}

export function withCreatedZeroUnits(feature) {
  return needsCreatedZeroUnits(feature) ? { ...feature, units: 0 } : feature
}

/**
 * A list page's `prepareProjectForDisplay` for one post-intervention layer.
 *
 * @param {string} layer e.g. 'hedgerows'
 * @returns {(project: object) => object}
 */
export function createdZeroUnitsDisplay(layer) {
  return (project) => {
    const features = project?.postIntervention?.[layer] ?? []
    if (!features.some(needsCreatedZeroUnits)) {
      return project
    }
    return {
      ...project,
      postIntervention: {
        ...project.postIntervention,
        [layer]: features.map(withCreatedZeroUnits)
      }
    }
  }
}
