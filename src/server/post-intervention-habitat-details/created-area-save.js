import { UNCHANGED_VALUE } from '../../shared/created-area-details.js'
import { saveHabitat } from '../common/helpers/habitat-details-controller.js'
import { ENCROACHMENT_FIELDS } from './created-area-edit-fields.js'

// The PUT a Created or Enhanced feature's edit page sends for a save: what
// each choice sends, what it leaves out, and how a kept choice is sent back.
// Split out of created-area-edit.js, which builds and checks the page.

function timingPayload(values, field, keepBlank = false) {
  if (
    values[field] === UNCHANGED_VALUE ||
    (keepBlank && values[field] === '')
  ) {
    return {}
  }
  return { [field]: values[field] === '' ? null : values[field] }
}

function habitatTypePayload(values, kind, feature) {
  if (
    !kind.hasBroadHabitat &&
    values.condition === UNCHANGED_VALUE &&
    feature
  ) {
    // The backend compares types before preserving an omitted condition.
    // Keep a stored empty string distinct from null on an unchanged-type save.
    return feature.proposed?.type ?? null
  }
  return values.habitatType || null
}

function advancePayload(values, kind, feature) {
  const hasPositiveDelay = Number.parseFloat(values.delayYears) > 0
  // Preserve a lineage-hidden advance on rename, but clear it for a positive delay.
  const keepBlank =
    kind.restoresLineageAdvance &&
    feature &&
    feature.proposed?.advanceYears == null &&
    !hasPositiveDelay
  return timingPayload(values, 'advanceYears', keepBlank)
}

// The stored proposed field each kept choice of an Enhanced area sends back.
const STORED_CHOICE_FIELDS = Object.freeze({
  broadHabitat: 'broadType',
  habitatType: 'type',
  condition: 'condition'
})

// An Enhanced area's kept choices, as their stored values: the backend
// requires every choice with a reference and accepts one left as stored.
function withStoredChoices(values, kind, feature) {
  if (!kind.preservesStoredChoices) {
    return values
  }
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) =>
      value === UNCHANGED_VALUE && Object.hasOwn(STORED_CHOICE_FIELDS, field)
        ? [field, feature?.proposed?.[STORED_CHOICE_FIELDS[field]] ?? '']
        : [field, value]
    )
  )
}

function createdAreaSavePayload(submitted, kind, feature) {
  const values = withStoredChoices(submitted, kind, feature)
  return {
    ref: values.ref.trim(),
    ...(kind.hasBroadHabitat ? { broadType: values.broadHabitat || null } : {}),
    ...(values.habitatType === UNCHANGED_VALUE
      ? {}
      : { habitatType: habitatTypePayload(values, kind, feature) }),
    ...(kind.hasBroadHabitat || values.condition !== UNCHANGED_VALUE
      ? { condition: values.condition || null }
      : {}),
    ...timingPayload(values, 'strategicSignificance'),
    ...advancePayload(values, kind, feature),
    ...timingPayload(values, 'delayYears'),
    ...(kind.hasEncroachments
      ? Object.assign(
          {},
          ...ENCROACHMENT_FIELDS.map((field) => timingPayload(values, field))
        )
      : {})
  }
}

export async function saveCreatedArea(request, values, kind, feature = null) {
  const { projectId, featureId } = request.payload
  return saveHabitat(
    request,
    `projects/${projectId}/post-intervention/${kind.savePath}/${featureId}`,
    createdAreaSavePayload(values, kind, feature)
  )
}
