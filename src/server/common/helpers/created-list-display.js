import { createLogger } from './logging/logger.js'
import { sourceValue } from './post-intervention-habitat-grid.js'
import {
  needsCreatedZeroUnits,
  withCreatedZeroUnits
} from './created-zero-units-display.js'
import { createdStrategicSignificance } from '../../post-intervention-habitat-details/created-strategic-significance.js'
import {
  featureRetentionCategory,
  RETENTION_CREATED
} from '../../post-intervention-habitat-details/retention.js'

// BMD-1048 AC11 (areas) and BMD-1050 AC11 (watercourses): a Created habitat
// saved Incomplete has no engine result, so its list row would show no units,
// distinctiveness or significance. The row shows zero units and the values its
// saved inputs determine on their own, taken from the creation reference data
// the edit form uses. Display only: the stored project is left unchanged.

const logger = createLogger()

const SIGNIFICANCE_FIELDS = [
  'strategicSignificanceCategory',
  'strategicSignificanceScore'
]

function missing(value) {
  return value == null || value === ''
}

function isCreated(feature) {
  return featureRetentionCategory(feature) === RETENTION_CREATED
}

/**
 * A list page's `prepareProjectForDisplay` for the Created habitats of one
 * post-intervention layer.
 *
 * @param {object} options
 * @param {string} options.layer the post-intervention layer, e.g. 'watercourses'
 * @param {string} options.label what a log line calls the habitat, e.g. 'Created watercourse'
 * @param {() => Promise<object>} options.loadReference the layer's creation reference
 * @param {(feature: object, types: object[]) => object | undefined} options.findType
 *   the reference type the feature's saved habitat type is
 * @param {string[]} options.typeFields the fields its habitat type alone determines
 * @returns {(project: object) => Promise<object>}
 */
export function createdListDisplay({
  layer,
  label,
  loadReference,
  findType,
  typeFields
}) {
  function missingTypeFields(feature) {
    return typeFields.some((field) =>
      missing(sourceValue(feature, feature.proposed, field))
    )
  }

  // Each field is filled only where its own saved value is missing, so a saved
  // label or a saved zero score is never replaced.
  function typeFieldsFromReference(feature, type) {
    if (!type) {
      return {}
    }
    return Object.fromEntries(
      typeFields
        .filter((field) =>
          missing(sourceValue(feature, feature.proposed, field))
        )
        .map((field) => [field, type[field]])
    )
  }

  function needsReference(feature) {
    if (!isCreated(feature)) {
      return false
    }
    const proposed = feature.proposed ?? {}
    const type = sourceValue(feature, proposed, 'type')
    const significance =
      proposed.strategicSignificanceCategory ?? proposed.strategicSignificance
    return (
      (type && missingTypeFields(feature)) ||
      (significance &&
        SIGNIFICANCE_FIELDS.some((field) => missing(proposed[field])))
    )
  }

  function needsDisplayProjection(feature) {
    return needsReference(feature) || needsCreatedZeroUnits(feature)
  }

  function withReferenceFields(feature, reference) {
    if (!reference || !needsReference(feature)) {
      return feature
    }
    const proposed = feature.proposed ?? {}
    const type = findType(feature, reference.habitatTypes ?? [])
    const category = createdStrategicSignificance(
      proposed.strategicSignificanceCategory ?? proposed.strategicSignificance
    )
    const significance = (reference.strategicSignificance ?? []).find(
      (s) => s.value === category
    )
    const independentFields = {
      strategicSignificanceCategory: significance?.value,
      strategicSignificanceScore: significance?.score
    }
    return {
      ...feature,
      proposed: {
        ...proposed,
        ...typeFieldsFromReference(feature, type),
        ...Object.fromEntries(
          Object.entries(independentFields).filter(
            ([field, value]) => missing(proposed[field]) && value != null
          )
        )
      }
    }
  }

  // The derived values are optional display data, so a reference outage must
  // not make the list unavailable: the rows then show only what the project
  // holds.
  async function loadReferenceForDisplay() {
    try {
      return await loadReference()
    } catch (error) {
      logger.warn(
        `${label} reference unavailable for list display: ${error.message}`
      )
      return null
    }
  }

  return async function prepareCreatedListDisplay(project) {
    const features = project?.postIntervention?.[layer] ?? []
    if (!features.some(needsDisplayProjection)) {
      return project
    }
    const reference = features.some(needsReference)
      ? await loadReferenceForDisplay()
      : null
    return {
      ...project,
      postIntervention: {
        ...project.postIntervention,
        [layer]: features.map((feature) =>
          withCreatedZeroUnits(withReferenceFields(feature, reference))
        )
      }
    }
  }
}
