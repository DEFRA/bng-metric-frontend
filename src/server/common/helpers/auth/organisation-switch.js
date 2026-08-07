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
//
// WHICH keys get cleared is not decided here — ../session-keys.js is the single
// home for that, so a future project-scoped key outside the upload journeys has
// one obvious place to be registered.
import { ORG_SCOPED_SESSION_KEYS } from '../session-keys.js'

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
