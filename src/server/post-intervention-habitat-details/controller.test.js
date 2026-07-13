import { wreck } from '../common/helpers/wreck-client.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const { getController, postController } = await import('./controller.js')

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const featureId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const createMockH = () => ({
  view: vi.fn().mockReturnThis(),
  redirect: vi.fn().mockReturnThis()
})

const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const projectPayload = { payload: { project: { name: 'Test Project' } } }
const projectWithBaselinePayload = {
  payload: {
    project: {
      name: 'Test Project',
      baseline: { habitats: [{ featureId: baselineFeatureId, ref: 'P-1' }] }
    }
  }
}

function isProjectUrl(url) {
  return (
    url.includes(`/projects/${projectId}`) &&
    !url.includes('/post-intervention/features/')
  )
}

describe('#postInterventionHabitatDetailsController', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('GET renders the read-only area details page for a retained area habitat', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'habitat',
            feature: {
              featureId,
              ref: 'P-1',
              sizeSquareMetres: 25000,
              units: 2.5,
              baseline: { retentionCategory: 'Retained' },
              proposed: {
                broadType: 'Grassland',
                type: 'Modified grassland',
                condition: 'Good',
                conditionScore: 3,
                distinctiveness: 'Low',
                distinctivenessScore: 2
              }
            }
          }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve(projectWithBaselinePayload)
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details',
      expect.objectContaining({
        heading: 'Post-intervention habitat details',
        caption: 'Test Project',
        habitatRef: 'P-1',
        interventionDisplay: 'Retained',
        sizeDisplay: '2.5ha',
        broadHabitatDisplay: 'Grassland',
        habitatTypeDisplay: 'Modified grassland',
        distinctivenessDisplay: 'Low (2)',
        conditionDisplay: 'Good (3)',
        strategicSignificanceDisplay: 'Low (1)',
        habitatUnitsDisplay: '2.50',
        // Baseline feature resolved by ref, not the PI featureId.
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: `/projects/${projectId}/post-intervention-habitat-list#area-habitats`
      })
    )
    // View-only: no form action is passed to the template.
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
  })

  test('GET omits the baseline link when no baseline feature shares the ref', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'habitat',
            feature: { featureId, ref: 'P-99', proposed: {} }
          }
        })
      }
      if (isProjectUrl(url)) {
        // Baseline has a different parcel ref, so there is no match.
        return Promise.resolve(projectWithBaselinePayload)
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details',
      expect.objectContaining({ viewBaselineHref: null })
    )
  })

  test('GET falls back gracefully when the project fetch fails', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'habitat',
            feature: { featureId, ref: 'P-1', proposed: {} }
          }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.reject(new Error('backend down'))
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details',
      expect.objectContaining({ caption: 'Project', viewBaselineHref: null })
    )
  })

  test('GET omits the baseline link when the area feature has no ref', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: { type: 'habitat', feature: { featureId, proposed: {} } }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve(projectWithBaselinePayload)
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details',
      expect.objectContaining({ viewBaselineHref: null })
    )
  })

  test('GET shows the unsupported-feature message for an individual tree', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: { type: 'tree', feature: { featureId, ref: 'T-1' } }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve(projectPayload)
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-feature-unsupported',
      expect.objectContaining({
        caption: 'Test Project',
        message: expect.stringContaining('not yet supported'),
        backHref: `/projects/${projectId}/post-intervention-habitat-list#area-habitats`
      })
    )
  })

  test('GET renders the read-only watercourse details page for a retained watercourse', async () => {
    const watercourseBaselinePayload = {
      payload: {
        project: {
          name: 'Test Project',
          baseline: {
            watercourses: [{ featureId: baselineFeatureId, ref: 'W-1' }]
          }
        }
      }
    }
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'watercourse',
            feature: {
              featureId,
              ref: 'W-1',
              sizeMetres: 1234.56,
              units: 6.5,
              baseline: { retentionCategory: 'Retained' },
              proposed: {
                type: 'Ditches',
                condition: 'Moderate',
                conditionScore: 2,
                distinctiveness: 'Low',
                distinctivenessScore: 4,
                watercourseEncroachment: 'Minor',
                waterEncroachmentMultiplier: 0.8,
                riparianEncroachment: 'Minor/No Encroachment',
                riparianEncroachmentMultiplier: 0.98
              }
            }
          }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve(watercourseBaselinePayload)
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-watercourse-details',
      expect.objectContaining({
        heading: 'Post-intervention habitat details',
        habitatRef: 'W-1',
        interventionDisplay: 'Retained',
        sizeDisplay: '1.23456',
        habitatTypeDisplay: 'Ditches',
        distinctivenessDisplay: 'Low (4)',
        conditionDisplay: 'Moderate (2)',
        watercourseEncroachmentDisplay: 'Minor (0.8)',
        riparianEncroachmentDisplay: 'Minor/No Encroachment (0.98)',
        strategicSignificanceDisplay: 'Low (1)',
        habitatUnitsDisplay: '6.50',
        // Baseline watercourse resolved by ref, not the PI featureId.
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: `/projects/${projectId}/post-intervention-habitat-list#watercourses`
      })
    )
    // View-only: no form action is passed to the template.
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
  })

  test('GET delegates hedgerows to the shared editable details page', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'hedgerow',
            feature: {
              featureId,
              ref: 'H-1',
              sizeMetres: 100,
              proposed: { type: 'Native hedgerow' }
            }
          }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve(projectPayload)
      }
      if (url.includes('/reference/hedgerow-types')) {
        return Promise.resolve({ payload: [] })
      }
      if (url.includes('/reference/trading-rules')) {
        return Promise.resolve({ payload: {} })
      }
      if (url.includes('/reference/conditions')) {
        return Promise.resolve({ payload: [] })
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/habitat-details',
      expect.objectContaining({
        formAction: '/post-intervention-habitat-details',
        detailsSectionHeading: 'Post-intervention Details'
      })
    )
  })

  test('POST saves to the post-intervention habitat endpoint', async () => {
    vi.mocked(wreck.put).mockResolvedValue({ res: { statusCode: 200 } })
    const h = createMockH()

    await postController.handler(
      {
        payload: {
          projectId,
          featureId,
          broadHabitat: 'Grassland',
          habitatType: 'Modified grassland',
          condition: 'Good'
        }
      },
      h
    )

    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(
        `/projects/${projectId}/post-intervention/habitats/${featureId}`
      ),
      expect.any(Object)
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/post-intervention-habitat-list#habitat-${featureId}`
    )
  })
})
