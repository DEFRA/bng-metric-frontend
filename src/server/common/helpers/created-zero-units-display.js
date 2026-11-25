import { isFiniteNumber } from './unit-summary.js'
import {
  featureRetentionCategory,
  RETENTION_CREATED,
  RETENTION_ENHANCED
} from '../../post-intervention-habitat-details/retention.js'

// BMD-1048 AC2 and AC11: an incomplete Created habitat shows zero units, on its
// list row as on its details page. BMD-1045, BMD-1046 and BMD-1047 AC2: so
// does an incomplete Enhanced area habitat, hedgerow or watercourse, the
// layers whose Enhanced features have an edit page. Display
// only: the stored units, null after an import or zero after an edit save, are
// left unchanged.

/**
 * @typedef {object} ZeroUnitsOptions
 * @property {boolean} [includeEnhanced] also show an Enhanced feature's
 *   missing units as zero
 */

function showsZeroUnits(feature, includeEnhanced) {
  const retention = featureRetentionCategory(feature)
  return (
    retention === RETENTION_CREATED ||
    (includeEnhanced && retention === RETENTION_ENHANCED)
  )
}

/**
 * @param {object} feature
 * @param {ZeroUnitsOptions} [options]
 */
export function needsCreatedZeroUnits(feature, { includeEnhanced } = {}) {
  return (
    showsZeroUnits(feature, includeEnhanced) && !isFiniteNumber(feature.units)
  )
}

/**
 * @param {object} feature
 * @param {ZeroUnitsOptions} [options]
 */
export function withCreatedZeroUnits(feature, options) {
  return needsCreatedZeroUnits(feature, options)
    ? { ...feature, units: 0 }
    : feature
}

/**
 * A list page's `prepareProjectForDisplay` for one post-intervention layer.
 *
 * @param {string} layer e.g. 'hedgerows'
 * @param {ZeroUnitsOptions} [options]
 * @returns {(project: object) => object}
 */
export function createdZeroUnitsDisplay(layer, options) {
  return (project) => {
    const features = project?.postIntervention?.[layer] ?? []
    if (!features.some((feature) => needsCreatedZeroUnits(feature, options))) {
      return project
    }
    return {
      ...project,
      postIntervention: {
        ...project.postIntervention,
        [layer]: features.map((feature) =>
          withCreatedZeroUnits(feature, options)
        )
      }
    }
  }
}
