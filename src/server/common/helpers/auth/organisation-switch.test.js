import { describe, expect, test, vi } from 'vitest'

import { clearStateOnOrganisationSwitch } from './organisation-switch.js'
import { ORG_SCOPED_SESSION_KEYS } from '../session-keys.js'

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

  // The registry itself (what belongs in the list, and what deliberately does
  // not) is covered by session-keys.test.js; this asserts the switch acts on
  // all of it, however it is composed.
  test('clears every key the registry declares', () => {
    const request = buildRequest(
      Object.fromEntries(ORG_SCOPED_SESSION_KEYS.map((key) => [key, 'set']))
    )

    clearStateOnOrganisationSwitch(request, REL_A, REL_B)

    for (const key of ORG_SCOPED_SESSION_KEYS) {
      expect(request.yar.clear).toHaveBeenCalledWith(key)
      expect(request._store.has(key)).toBe(false)
    }
  })
})
