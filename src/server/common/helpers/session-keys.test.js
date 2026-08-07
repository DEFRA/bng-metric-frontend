import { describe, expect, test } from 'vitest'

import {
  NON_UPLOAD_ORG_SCOPED_KEYS,
  ORG_SCOPED_SESSION_KEYS,
  UPLOAD_ORG_SCOPED_KEYS
} from './session-keys.js'
import { HABITAT_UPLOAD_TYPES } from './habitat-upload-types.js'

// Every key the upload types declare, found by naming convention rather than by
// repeating the list — so this cannot drift in step with the code it guards.
function declaredUploadSessionKeys() {
  return Object.values(HABITAT_UPLOAD_TYPES).flatMap((uploadType) =>
    Object.entries(uploadType)
      .filter(([name]) => name.endsWith('SessionKey'))
      .map(([, key]) => key)
  )
}

describe('org-scoped session keys', () => {
  // The half of the convention that CAN be enforced: a new KIND of key added to
  // an upload type fails here until it is registered, instead of silently
  // surviving an org switch.
  test('covers every session key declared by the upload types', () => {
    expect(new Set(UPLOAD_ORG_SCOPED_KEYS)).toEqual(
      new Set(declaredUploadSessionKeys())
    )
  })

  test('is the union of the upload-derived and non-upload lists', () => {
    expect(new Set(ORG_SCOPED_SESSION_KEYS)).toEqual(
      new Set([...UPLOAD_ORG_SCOPED_KEYS, ...NON_UPLOAD_ORG_SCOPED_KEYS])
    )
  })

  test('picks up anything registered as a non-upload project-scoped key', () => {
    // NON_UPLOAD_ORG_SCOPED_KEYS is empty today; this asserts the wiring works
    // so the first entry added there is cleared without a second edit.
    for (const key of NON_UPLOAD_ORG_SCOPED_KEYS) {
      expect(ORG_SCOPED_SESSION_KEYS).toContain(key)
    }
    expect(ORG_SCOPED_SESSION_KEYS).toHaveLength(
      UPLOAD_ORG_SCOPED_KEYS.length + NON_UPLOAD_ORG_SCOPED_KEYS.length
    )
  })

  test('contains no duplicates', () => {
    // Both upload types share `validationUploadType`; the dedupe must hold.
    expect(new Set(ORG_SCOPED_SESSION_KEYS).size).toBe(
      ORG_SCOPED_SESSION_KEYS.length
    )
  })

  // Clearing any of these would break sign-in rather than scope it: `auth` IS
  // the session, and the other three are about the session's lifecycle, not
  // about any project.
  test.each(['auth', 'oidc', 'sessionEnded', 'slidAt'])(
    'never clears the session-lifecycle key %s',
    (key) => {
      expect(ORG_SCOPED_SESSION_KEYS).not.toContain(key)
    }
  )
})
