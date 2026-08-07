// The registry of `yar` session keys that are scoped to a PROJECT, and so must
// be cleared when the user changes organisation.
//
// Projects are scoped to the org the user is signed in as (the backend matches
// a project's relationship_id against the token's currentRelationshipId — see
// bng-metric-backend/src/db/project-visibility.js, BMD-890). Any session state
// that names or describes a project therefore belongs to exactly one org, and
// must not survive a switch: left behind it resurfaces as an upload-error
// banner or a validation-error list for a project the user can no longer open.
//
// This module is the one place that answers "does my new session key need
// clearing on an org switch?". If you add a key holding a project id, an upload
// id, or anything derived from project data, add it to
// NON_UPLOAD_ORG_SCOPED_KEYS below.
//
// NOTE — this is a convention, not an enforced contract. Nothing stops a new
// project-scoped key being written straight through `request.yar.set` without
// being registered here, and CI will not catch it. Full enforcement would mean
// routing every session write through this module, which is a much larger
// refactor than the risk currently justifies. The drift test in
// session-keys.test.js does enforce the half that can be checked: that every
// key the upload types declare is covered.
import { HABITAT_UPLOAD_TYPES } from './habitat-upload-types.js'

// Read off the upload-type definitions, which own the actual key names — so a
// NEW UPLOAD TYPE has all six of its keys cleared without touching this file.
// Adding a new KIND of key to an existing type is not picked up automatically:
// the six property names below are still listed by hand. What catches that is
// the drift test in session-keys.test.js, which asserts this list matches every
// `*SessionKey` the upload types declare — so a seventh kind fails the build and
// forces the edit here rather than silently surviving an org switch.
//
// The Set dedupes `validationUploadTypeSessionKey`, which is deliberately the
// same key ('validationUploadType') for both types: it records WHICH type the
// stored validation errors came from, so there is only ever one of it.
const UPLOAD_ORG_SCOPED_KEYS = [
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

// Project-scoped keys that do NOT come from an upload type. Empty today —
// every project-scoped key currently in the app belongs to an upload journey —
// but this is where the next one goes. Kept as an explicit export rather than
// an inline `[]` so it is greppable and has somewhere to hang this comment.
const NON_UPLOAD_ORG_SCOPED_KEYS = []

// Session keys deliberately NOT cleared on an org switch, recorded so a reader
// can tell "considered and excluded" from "overlooked":
//
//   auth          the session itself — the switch REPLACES it, clearing it here
//                 would sign the user out mid-flow
//   oidc          transient PKCE/state/nonce for the in-flight login; the
//                 callback clears it on its own
//   sessionEnded  expiry breadcrumb, already cleared by clearSessionEnded()
//   slidAt        idle-timeout stamp; about the session, not any project
const ORG_SCOPED_SESSION_KEYS = [
  ...UPLOAD_ORG_SCOPED_KEYS,
  ...NON_UPLOAD_ORG_SCOPED_KEYS
]

export {
  ORG_SCOPED_SESSION_KEYS,
  UPLOAD_ORG_SCOPED_KEYS,
  NON_UPLOAD_ORG_SCOPED_KEYS
}
