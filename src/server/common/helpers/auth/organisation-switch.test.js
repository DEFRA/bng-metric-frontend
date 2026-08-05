import { describe, expect, test, vi } from 'vitest'

import {
  ORG_SCOPED_SESSION_KEYS,
  clearStateOnOrganisationSwitch
} from './organisation-switch.js'
import { HABITAT_UPLOAD_TYPES } from '../habitat-upload-types.js'

const REL_A = 'rel-org-a'
const REL_B = 'rel-org-b'

function buildRequest(sessionEntries = {}) {
  const store = new Map(Object.entries(sessionEntries))
  return {
    yar: {
      get: vi.fn((key) => store.get(key)),
      set: vi.fn((key, value) => store.set(key, value)),
      clear: vi.fn((key) => store.delete(key))
    },
    logger: { info: vi.fn() },
    _store: store
  }
}

const journeyState = () => ({
  pendingUploadId: 'upload-1',
  uploadStartedAt: 1700000000000,
  uploadError: 'Something went wrong',
  baselineValidationErrors: [{ code: 'X', message: 'bad' }],
  baselineValidationErrorsProjectId: 'project-in-org-a',
  validationUploadType: 'baseline',
  postInterventionPendingUploadId: 'upload-2',
  postInterventionValidationErrors: [{ code: 'Y', message: 'worse' }],
  postInterventionValidationErrorsProjectId: 'project-in-org-a'
})

describe('#clearStateOnOrganisationSwitch', () => {
  test('clears the journey state when the user changes organisation', () => {
    const request = buildRequest(journeyState())

    const switched = clearStateOnOrganisationSwitch(request, REL_A, REL_B)

    expect(switched).toBe(true)
    for (const key of Object.keys(journeyState())) {
      expect(request._store.has(key)).toBe(false)
    }
    expect(request.logger.info).toHaveBeenCalled()
  })

  test('keeps the journey intact when signing in again as the same organisation', () => {
    // Session expiry mid-upload must not cost the user their pending upload.
    const request = buildRequest(journeyState())

    const switched = clearStateOnOrganisationSwitch(request, REL_A, REL_A)

    expect(switched).toBe(false)
    expect(request.yar.clear).not.toHaveBeenCalled()
    expect(request._store.get('pendingUploadId')).toBe('upload-1')
  })

  test('does nothing on a first sign-in (no previous organisation)', () => {
    const request = buildRequest(journeyState())

    expect(clearStateOnOrganisationSwitch(request, null, REL_A)).toBe(false)
    expect(request.yar.clear).not.toHaveBeenCalled()
  })

  test('leaves the auth session itself alone', () => {
    const request = buildRequest({
      ...journeyState(),
      auth: { user: { sub: 'user-1', currentRelationshipId: REL_B } }
    })

    clearStateOnOrganisationSwitch(request, REL_A, REL_B)

    expect(request._store.get('auth')).toEqual({
      user: { sub: 'user-1', currentRelationshipId: REL_B }
    })
  })

  test('covers every session key declared by the upload types', () => {
    // Guards against a new key being added to habitat-upload-types.js and
    // silently surviving an org switch.
    const declared = Object.values(HABITAT_UPLOAD_TYPES).flatMap((uploadType) =>
      Object.entries(uploadType)
        .filter(([name]) => name.endsWith('SessionKey'))
        .map(([, value]) => value)
    )

    expect(new Set(ORG_SCOPED_SESSION_KEYS)).toEqual(new Set(declared))
  })
})
