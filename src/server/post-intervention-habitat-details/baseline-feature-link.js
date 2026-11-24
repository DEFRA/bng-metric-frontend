// The baseline feature a post-intervention details page links to with "View
// baseline details": by parent for a BNG Service template project, and by
// reference within the feature's layer for a legacy one.

import { isServiceTemplateDocument } from '../common/helpers/service-template.js'
import { VERTICAL_HABITAT_TYPE } from '../common/helpers/vertical-habitats.js'
import { featureRetentionCategory, RETENTION_CREATED } from './retention.js'

const AREA_HABITAT_TYPE = 'habitat'
const TREE_TYPE = 'tree'
const HEDGEROW_TYPE = 'hedgerow'
const WATERCOURSE_TYPE = 'watercourse'

/**
 * A ref as the backend stores it: as text, trimmed (the backend's
 * cleanHabitatRef). Since BMD-1175 a ref over the limit is refused, never
 * cut, so it is not cut here either. A baseline saved before BMD-1058 may
 * hold ' H001' or 12, so both sides are compared cleaned. Null when there is
 * none.
 */
function comparableRef(ref) {
  if (typeof ref !== 'string' && typeof ref !== 'number') {
    return null
  }
  const cleaned = String(ref).trim()
  return cleaned === '' ? null : cleaned
}

// The baseline layer a post-intervention feature of each type is joined to.
const BASELINE_LAYER_BY_TYPE = new Map([
  [AREA_HABITAT_TYPE, 'habitats'],
  [VERTICAL_HABITAT_TYPE, 'verticalHabitats'],
  [TREE_TYPE, 'trees'],
  [HEDGEROW_TYPE, 'hedgerows'],
  [WATERCOURSE_TYPE, 'watercourses']
])

// The values a post-intervention row's `baseline` snapshot copies from its
// parcel, which tell parcels sharing a ref apart (as the backend's re-sync does).
const SNAPSHOT_FIELDS = ['type', 'broadType', 'condition']

function matchesSnapshot(candidate, snapshot) {
  return SNAPSHOT_FIELDS.every(
    (field) =>
      !Object.hasOwn(candidate, field) || candidate[field] === snapshot?.[field]
  )
}

/**
 * Resolve the baseline feature that corresponds to a post-intervention parcel
 * of a legacy project. Baseline and PI are separate uploads with independent
 * featureIds, so the only stable join key is the parcel ref, matched within
 * the feature's own layer: a hedgerow and an area habitat may share a ref.
 * Where an import left several parcels on the ref, the one the row's baseline
 * snapshot describes wins, else the first. Returns null when no baseline has
 * been uploaded or no baseline feature in the layer shares the ref.
 *
 * @param {object} project
 * @param {string} type the feature type from the PI feature endpoint
 * @param {object} feature the post-intervention feature
 * @returns {string|null}
 */
function resolveBaselineFeatureId(project, type, feature) {
  const wanted = comparableRef(feature.ref)
  const layer = BASELINE_LAYER_BY_TYPE.get(type)
  if (!wanted || !layer) {
    return null
  }
  const candidates = (project?.project?.baseline?.[layer] ?? []).filter(
    (candidate) => comparableRef(candidate.ref) === wanted
  )
  const described = candidates.filter((candidate) =>
    matchesSnapshot(candidate, feature.baseline)
  )
  const match = described.length === 1 ? described[0] : candidates[0]
  return match?.featureId ?? null
}

const BASELINE_LAYERS = [
  'habitats',
  'verticalHabitats',
  'trees',
  'hedgerows',
  'watercourses'
]

/**
 * The baseline feature a BNG Service template post-intervention feature names
 * as its parent: the one it continues or enhances. The backend links it by the
 * parent_uuid in the file, so refs play no part: a feature with no
 * parentFeatureId has no baseline link, and neither does one whose parent the
 * baseline no longer holds.
 */
function parentBaselineFeatureId(project, feature) {
  const parentId = feature.parentFeatureId
  if (!parentId) {
    return null
  }
  const baseline = project?.project?.baseline
  const exists = BASELINE_LAYERS.some((layer) =>
    baseline?.[layer]?.some((f) => f.featureId === parentId)
  )
  return exists ? parentId : null
}

/**
 * Whether the project's post-intervention document was uploaded in the BNG
 * Service template. Its features link to their parents by parentFeatureId,
 * and its trees have no Count, so show no number of trees.
 *
 * @param {object|null} project
 * @returns {boolean}
 */
export function isServiceTemplateProject(project) {
  return isServiceTemplateDocument(project?.project?.postIntervention)
}

/**
 * A Created feature's page links to no baseline feature, whatever its type:
 * it is recorded as a creation of its own. That holds for one Created over a
 * baseline feature it degrades, though it names that feature as its parent, as
 * Natural England's template records a degraded habitat as Created.
 */
const isUnlinked = (feature) =>
  featureRetentionCategory(feature) === RETENTION_CREATED

/**
 * The baseline feature a Retained or Enhanced post-intervention feature's
 * "View baseline details" opens; null for a Created one. A feature renamed on
 * its own page, such as an Enhanced area habitat (BMD-1045), carries the
 * parent it was renamed from, as its new ref may match no baseline feature,
 * or the wrong one.
 *
 * @param {object} project
 * @param {string} type the feature type from the PI feature endpoint
 * @param {object} feature the post-intervention feature, as fetched
 * @returns {string|null}
 */
export function baselineFeatureIdFor(project, type, feature) {
  if (isUnlinked(feature)) {
    return null
  }
  if (
    isServiceTemplateProject(project) ||
    Object.hasOwn(feature, 'parentFeatureId')
  ) {
    return parentBaselineFeatureId(project, feature)
  }
  return resolveBaselineFeatureId(project, type, feature)
}
