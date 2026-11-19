import { saveHabitat } from '../common/helpers/habitat-details-controller.js'
import { cleanComment } from '../common/helpers/habitat-comment.js'
import { ENCROACHMENT_FIELDS } from './created-area-edit-fields.js'

// The PUT a Created or Enhanced feature's edit page sends for a save: every
// choice, with the default option sent as null, so a stored value the page's
// list did not offer (shown blank) is cleared. Split out of
// created-area-edit.js, which builds and checks the page.

function choicePayload(values, field, keepBlank = false) {
  if (keepBlank && values[field] === '') {
    return {}
  }
  return { [field]: values[field] || null }
}

function advancePayload(values, kind, feature) {
  const hasPositiveDelay = Number.parseFloat(values.delayYears) > 0
  // Preserve a lineage-hidden advance on rename, but clear it for a positive delay.
  const keepBlank =
    kind.restoresLineageAdvance &&
    feature &&
    feature.proposed?.advanceYears == null &&
    !hasPositiveDelay
  return choicePayload(values, 'advanceYears', keepBlank)
}

// Sent only when the form has the box: a post without it keeps the stored
// comment. Blank is sent as null, which the backend stores as no value.
function commentPayload(values, kind) {
  if (!kind.hasComment || values.comment === undefined) {
    return {}
  }
  return { comment: cleanComment(values.comment) || null }
}

function createdAreaSavePayload(values, kind, feature) {
  return {
    ...commentPayload(values, kind),
    ref: values.ref.trim(),
    ...(kind.hasBroadHabitat ? { broadType: values.broadHabitat || null } : {}),
    habitatType: values.habitatType || null,
    condition: values.condition || null,
    ...choicePayload(values, 'strategicSignificance'),
    ...advancePayload(values, kind, feature),
    ...choicePayload(values, 'delayYears'),
    ...(kind.hasEncroachments
      ? Object.assign(
          {},
          ...ENCROACHMENT_FIELDS.map((field) => choicePayload(values, field))
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
