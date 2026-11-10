import { createLogger } from '../common/helpers/logging/logger.js'
import { sourceValue } from '../common/helpers/post-intervention-habitat-grid.js'
import {
  needsCreatedZeroUnits,
  withCreatedZeroUnits
} from '../common/helpers/created-zero-units-display.js'
import { loadCreatedAreaReference } from '../post-intervention-habitat-details/created-edit-reference.js'
import { createdStrategicSignificance } from '../post-intervention-habitat-details/created-strategic-significance.js'
import {
  featureRetentionCategory,
  RETENTION_CREATED
} from '../post-intervention-habitat-details/retention.js'

const logger = createLogger()

function missing(value) {
  return value == null || value === ''
}

function isCreated(feature) {
  return featureRetentionCategory(feature) === RETENTION_CREATED
}

const TYPE_FIELDS = ['distinctiveness', 'distinctivenessScore']

function missingTypeFields(feature) {
  return TYPE_FIELDS.some((field) =>
    missing(sourceValue(feature, feature.proposed, field))
  )
}

// Each half of the pair is filled only where its own saved value is missing,
// so a saved label or a saved zero score is never replaced.
function typeFieldsFromReference(feature, type) {
  if (!type) {
    return {}
  }
  return Object.fromEntries(
    TYPE_FIELDS.filter((field) =>
      missing(sourceValue(feature, feature.proposed, field))
    ).map((field) => [field, type[field]])
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
      ['strategicSignificanceCategory', 'strategicSignificanceScore'].some(
        (field) => missing(proposed[field])
      ))
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
  const type = reference.habitatTypes.find(
    (t) =>
      t.name === sourceValue(feature, proposed, 'type') &&
      t.broad === sourceValue(feature, proposed, 'broadType')
  )
  const category = createdStrategicSignificance(
    proposed.strategicSignificanceCategory ?? proposed.strategicSignificance
  )
  const significance = reference.strategicSignificance.find(
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

function displayFeature(feature, reference) {
  return withCreatedZeroUnits(withReferenceFields(feature, reference))
}

// The derived values are optional display data, so a reference outage must not
// make the list unavailable: the rows then show only what the project holds.
async function loadReferenceForDisplay() {
  try {
    return await loadCreatedAreaReference()
  } catch (error) {
    logger.warn(
      `Created area reference unavailable for list display: ${error.message}`
    )
    return null
  }
}

// Complete unit calculations are not needed to display independently known attributes.
// Project data and calculation status remain unchanged; this is a display-only projection.
// Only area parcels (`habitats`) are projected: Created area editing and
// /reference/area-creation cover the `habitat` feature type, not green walls
// (`verticalHabitats`) or individual trees.
export async function prepareCreatedAreaListDisplay(project) {
  const features = project?.postIntervention?.habitats ?? []
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
      habitats: features.map((feature) => displayFeature(feature, reference))
    }
  }
}
