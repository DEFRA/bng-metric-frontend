import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { backendRequest } from './auth/backend-request.js'
import {
  createHabitatDetailsControllers,
  normalizePostInterventionFeatureForDisplay
} from './habitat-details-controller.js'
import { HABITAT_UPLOAD_TYPES } from './habitat-upload-types.js'
import { PI_FEATURE } from '../test-helpers/habitat-feature-fixtures.js'

vi.mock('./auth/backend-request.js', () => ({
  backendRequest: vi.fn()
}))

const mockLoadReference = vi.fn()
const mockBuildViewModel = vi.fn()

vi.mock('../../baseline-habitat-details/strategies/index.js', () => ({
  getStrategy: vi.fn(() => ({
    loadReference: mockLoadReference,
    buildViewModel: mockBuildViewModel
  }))
}))

const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const featureId = PI_FEATURE.featureId

describe('normalizePostInterventionFeatureForDisplay', () => {
  it('promotes proposed fields to top level', () => {
    const result = normalizePostInterventionFeatureForDisplay(PI_FEATURE)

    expect(result.type).toBe('Developed land; sealed surface')
    expect(result.broadType).toBe('Urban')
    expect(result.condition).toBe('N/A - Other')
    expect(result.distinctiveness).toBe('Low')
  })

  it('preserves top-level size and units fields', () => {
    const result = normalizePostInterventionFeatureForDisplay(PI_FEATURE)

    expect(result.featureId).toBe(PI_FEATURE.featureId)
    expect(result.area).toBe(7850)
    expect(result.units).toBe(3.14)
    expect(result.status).toBe('Complete')
  })

  it('retains both baseline and proposed sub-objects on the result', () => {
    const result = normalizePostInterventionFeatureForDisplay(PI_FEATURE)

    expect(result.baseline).toBe(PI_FEATURE.baseline)
    expect(result.proposed).toBe(PI_FEATURE.proposed)
  })

  it('does not mutate the original feature', () => {
    const original = structuredClone(PI_FEATURE)
    normalizePostInterventionFeatureForDisplay(PI_FEATURE)
    expect(PI_FEATURE).toEqual(original)
  })

  it('handles a missing proposed sub-object gracefully', () => {
    const featureWithoutProposed = { ...PI_FEATURE, proposed: undefined }
    const result = normalizePostInterventionFeatureForDisplay(
      featureWithoutProposed
    )

    expect(result.type).toBeUndefined()
    expect(result.area).toBe(7850)
  })
})

describe('createHabitatDetailsControllers', () => {
  const { getController, postController } = createHabitatDetailsControllers(
    HABITAT_UPLOAD_TYPES.postIntervention
  )

  beforeEach(() => {
    mockLoadReference.mockResolvedValue({})
    mockBuildViewModel.mockReturnValue({
      headingPrefix: 'Habitat',
      habitatRef: PI_FEATURE.ref,
      backHref: `/projects/${projectId}/post-intervention-habitat-list`,
      cancelHref: `/projects/${projectId}/post-intervention-habitat-list#habitat-${featureId}`
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('GET normalizes post-intervention features before building the view model', async () => {
    vi.mocked(backendRequest).mockImplementation((_request, _method, url) => {
      if (url.includes('/post-intervention/features/')) {
        return Promise.resolve({
          payload: { type: 'habitat', feature: PI_FEATURE }
        })
      } else {
        return Promise.resolve({
          payload: { project: { name: 'Test Project' } }
        })
      }
    })

    const h = { view: vi.fn().mockReturnThis() }
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(mockBuildViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Developed land; sealed surface',
        baseline: PI_FEATURE.baseline,
        proposed: PI_FEATURE.proposed
      }),
      {},
      expect.objectContaining({ projectId, projectName: 'Test Project' })
    )
    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/habitat-details',
      expect.objectContaining({
        detailsSectionHeading: 'Post-intervention Details'
      })
    )
  })

  it('POST redirects to the post-intervention list anchor', async () => {
    vi.mocked(backendRequest).mockResolvedValue({
      payload: { type: 'habitat' }
    })

    const h = { redirect: vi.fn().mockReturnThis() }
    await postController.handler(
      {
        payload: {
          projectId,
          featureId,
          broadHabitat: 'Urban',
          habitatType: 'Developed land; sealed surface',
          condition: 'N/A - Other'
        }
      },
      h
    )

    expect(backendRequest).toHaveBeenCalledWith(
      expect.anything(),
      'put',
      expect.stringContaining(
        `/projects/${projectId}/post-intervention/habitats/${featureId}`
      ),
      expect.objectContaining({
        payload: JSON.stringify({
          broadType: 'Urban',
          habitatType: 'Developed land; sealed surface',
          condition: 'N/A - Other'
        })
      })
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/post-intervention-habitat-list#habitat-${featureId}`
    )
  })

  it('POST uses hedgerow list anchor when the saved feature is a hedgerow', async () => {
    vi.mocked(backendRequest).mockResolvedValue({
      payload: { type: 'hedgerow' }
    })

    const h = { redirect: vi.fn().mockReturnThis() }
    await postController.handler(
      {
        payload: {
          projectId,
          featureId,
          broadHabitat: '',
          habitatType: 'Native hedge',
          condition: 'Good'
        }
      },
      h
    )

    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/post-intervention-habitat-list#hedgerows`
    )
  })

  it('POST uses watercourse list anchor when the saved feature is a watercourse', async () => {
    vi.mocked(backendRequest).mockResolvedValue({
      payload: { type: 'watercourse' }
    })

    const h = { redirect: vi.fn().mockReturnThis() }
    await postController.handler(
      {
        payload: {
          projectId,
          featureId,
          broadHabitat: '',
          habitatType: 'Modified watercourse',
          condition: 'Moderate',
          watercourseEncroachment: 'Minor',
          riparianEncroachment: 'None'
        }
      },
      h
    )

    expect(backendRequest).toHaveBeenCalledWith(
      expect.anything(),
      'put',
      expect.any(String),
      expect.objectContaining({
        payload: JSON.stringify({
          broadType: null,
          habitatType: 'Modified watercourse',
          condition: 'Moderate',
          watercourseEncroachment: 'Minor',
          riparianEncroachment: 'None'
        })
      })
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/post-intervention-habitat-list#watercourses`
    )
  })

  it('POST throws a 409 conflict error when the backend returns conflict', async () => {
    const conflictErr = new Error('conflict')
    conflictErr.output = { statusCode: 409 }
    vi.mocked(backendRequest).mockRejectedValue(conflictErr)

    const h = { redirect: vi.fn() }
    await expect(
      postController.handler(
        {
          payload: {
            projectId,
            featureId,
            broadHabitat: 'Grassland',
            habitatType: 'Lowland meadows',
            condition: 'Good'
          }
        },
        h
      )
    ).rejects.toMatchObject({ output: { statusCode: 409 } })
  })

  it('POST throws a 502 bad gateway for unexpected backend errors', async () => {
    vi.mocked(backendRequest).mockRejectedValue(new Error('network failure'))

    const h = { redirect: vi.fn() }
    await expect(
      postController.handler(
        {
          payload: {
            projectId,
            featureId,
            broadHabitat: 'Grassland',
            habitatType: 'Lowland meadows',
            condition: 'Good'
          }
        },
        h
      )
    ).rejects.toMatchObject({ output: { statusCode: 502 } })
  })
})
