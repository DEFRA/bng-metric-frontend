// Journey state left in the yar session when a user changes organisation.
//
// A user linked to several orgs can hold an approved 'bng completer' role in
// each, and switches between them with "Change organisation" (which re-runs the
// interactive sign-in with forceReselection=true). Their projects are scoped to
// the org they are signed in as — the backend's visibility predicate matches the
// project's relationship_id against the token's currentRelationshipId
// (bng-metric-backend/src/db/project-visibility.js, BMD-890) — so the in-flight
// journey state pointing at the PREVIOUS org's project must not survive the
// switch. Left in place it would resurface as an upload-error banner or a
// validation-error list for a project the user can no longer open.
//
// Only a genuine change of relationship clears it. Signing in again as the SAME
// org (e.g. after the session expired mid-upload) keeps the journey intact.
import { HABITAT_UPLOAD_TYPES } from '../habitat-upload-types.js'

// Read off the upload-type definitions, which own the actual key names — so a
// NEW UPLOAD TYPE has all six of its keys cleared without touching this file.
// Adding a new KIND of key to an existing type is not picked up automatically:
// the six property names below are still listed by hand. What catches that is
// the last test in organisation-switch.test.js, which asserts this list matches
// every `*SessionKey` the upload types declare — so a seventh kind fails the
// build and forces the edit here rather than silently surviving an org switch.
//
// The Set dedupes `validationUploadTypeSessionKey`, which is deliberately the
// same key ('validationUploadType') for both types: it records WHICH type the
// stored validation errors came from, so there is only ever one of it.
const ORG_SCOPED_SESSION_KEYS = [
  ...new Set(
    Object.values(HABITAT_UPLOAD_TYPES).flatMap((uploadType) => [
      uploadType.pendingUploadSessionKey,
      uploadType.uploadStartedAtSessionKey,
      uploadType.uploadErrorSessionKey,
      uploadType.validationErrorsSessionKey,
      uploadType.validationErrorsProjectIdSessionKey,
      uploadType.validationUploadTypeSessionKey
    ])
  )
]

/**
 * Drop the journey state tied to a project in the org the user has just left.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string|null|undefined} previousRelationshipId the currentRelationshipId
 *   held in the session before this sign-in
 * @param {string|null|undefined} nextRelationshipId the one carried by the new token
 * @returns {boolean} whether the org context changed (and state was cleared)
 */
export function clearStateOnOrganisationSwitch(
  request,
  previousRelationshipId,
  nextRelationshipId
) {
  // A first sign-in has nothing to carry over, and an unchanged (or absent)
  // relationship is not a switch.
  if (
    !previousRelationshipId ||
    previousRelationshipId === nextRelationshipId
  ) {
    return false
  }

  for (const key of ORG_SCOPED_SESSION_KEYS) {
    request.yar.clear(key)
  }

  request.logger?.info(
    { sub: request.yar.get('auth')?.user?.sub },
    'Auth: organisation context changed, cleared journey state scoped to the previous organisation'
  )
  return true
}

export { ORG_SCOPED_SESSION_KEYS }
