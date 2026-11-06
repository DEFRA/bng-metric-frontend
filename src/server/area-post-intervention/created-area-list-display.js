import { sourceValue } from '../common/helpers/post-intervention-habitat-grid.js'
import { loadCreatedAreaReference } from '../post-intervention-habitat-details/created-edit-reference.js'
import { createdStrategicSignificance } from '../post-intervention-habitat-details/created-strategic-significance.js'
import {
  featureRetentionCategory,
  RETENTION_CREATED
} from '../post-intervention-habitat-details/retention.js'

function missing(value) {
  return value == null || value === ''
}

function missingTypeFields(feature) {
  return ['distinctiveness', 'distinctivenessScore'].some((field) =>
    missing(sourceValue(feature, feature.proposed, field))
  )
}

function needsReference(feature) {
  if (featureRetentionCategory(feature) !== RETENTION_CREATED) return false
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

function withReferenceFields(feature, reference) {
  if (!needsReference(feature)) return feature
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
      ...(type && missingTypeFields(feature)
        ? {
            distinctiveness: type.distinctiveness,
            distinctivenessScore: type.distinctivenessScore
          }
        : {}),
      ...Object.fromEntries(
        Object.entries(independentFields).filter(
          ([field, value]) => missing(proposed[field]) && value != null
        )
      )
    }
  }
}

// Complete unit calculations are not needed to display independently known attributes.
// Project data and calculation status remain unchanged; this is a display-only projection.
export async function prepareCreatedAreaListDisplay(project) {
  const features = project?.postIntervention?.habitats ?? []
  if (!features.some(needsReference)) return project
  const reference = await loadCreatedAreaReference()
  return {
    ...project,
    postIntervention: {
      ...project.postIntervention,
      habitats: features.map((feature) =>
        withReferenceFields(feature, reference)
      )
    }
  }
}
