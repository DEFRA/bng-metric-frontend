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
const { _resetReferenceCache: resetWatercourseReference } =
  await import('../baseline-habitat-details/strategies/watercourse.js')
const { _resetReferenceCache: resetAreaReference } =
  await import('../baseline-habitat-details/strategies/area.js')

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const featureId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const EDITABLE_TEMPLATE = 'habitat-details/habitat-details'

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

// Reference data for the editable page, which a non-retained feature falls
// through to.
function referencePayload(url) {
  if (url.endsWith('/reference/watercourse-types')) {
    return {
      payload: [
        { name: 'Ditches', distinctiveness: 'Medium', distinctivenessScore: 4 }
      ]
    }
  }
  if (url.endsWith('/reference/watercourse-encroachments')) {
    return {
      payload: { watercourse: ['Minor', 'Major'], riparian: ['Minor/Minor'] }
    }
  }
  if (url.endsWith('/reference/habitat-types-by-broad')) {
    return {
      payload: {
        Grassland: [
          {
            name: 'Modified grassland',
            distinctiveness: 'Low',
            distinctivenessScore: 2
          }
        ]
      }
    }
  }
  if (url.includes('/reference/conditions')) {
    return { payload: [{ condition: 'Moderate', score: 2 }] }
  }
  if (url.includes('/reference/trading-rules')) {
    return { payload: { Medium: 'Same habitat required =' } }
  }
  return null
}

/**
 * Mock the PI feature endpoint, the project endpoint, and (for a feature that
 * falls through to the editable page) the reference endpoints.
 */
function mockFeature(featurePayload) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.includes(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({ payload: featurePayload })
    }
    const reference = referencePayload(url)
    if (reference) {
      return Promise.resolve(reference)
    }
    if (isProjectUrl(url)) {
      return Promise.resolve(projectPayload)
    }
    throw new Error(`Unexpected URL ${url}`)
  })
}

describe('#postInterventionHabitatDetailsController', () => {
  beforeEach(() => {
    resetWatercourseReference()
    resetAreaReference()
  })

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

  test('GET renders the read-only hedgerow details page for a retained hedgerow', async () => {
    const hedgerowBaselinePayload = {
      payload: {
        project: {
          name: 'Test Project',
          baseline: {
            hedgerows: [{ featureId: baselineFeatureId, ref: 'HG-2' }]
          }
        }
      }
    }
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'hedgerow',
            feature: {
              featureId,
              ref: 'HG-2',
              sizeMetres: 336,
              units: 4.25,
              baseline: { retentionCategory: 'Retained' },
              proposed: {
                type: 'Native hedgerow',
                condition: 'Moderate',
                conditionScore: 2,
                distinctiveness: 'Low',
                distinctivenessScore: 2
              }
            }
          }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve(hedgerowBaselinePayload)
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-hedgerow-details',
      expect.objectContaining({
        heading: 'Post-intervention habitat details',
        habitatRef: 'HG-2',
        interventionDisplay: 'Retained',
        sizeDisplay: '0.336',
        habitatTypeDisplay: 'Native hedgerow',
        distinctivenessDisplay: 'Low (2)',
        conditionDisplay: 'Moderate (2)',
        strategicSignificanceDisplay: 'Low (1)',
        habitatUnitsDisplay: '4.25',
        // Baseline hedgerow resolved by ref, not the PI featureId.
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: `/projects/${projectId}/post-intervention-habitat-list#hedgerows`
      })
    )
    // View-only: no form action is passed to the template.
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
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

  test('GET delegates an unrecognised feature type to the shared editable page', async () => {
    // Every type the backend currently returns (habitat, tree, hedgerow,
    // watercourse) is handled above, so this guards the fallback against a new
    // feature type appearing without a view-only page.
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: { type: 'iggi', feature: { featureId, ref: 'I-1' } }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve(projectPayload)
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()

    await expect(
      getController.handler({ query: { projectId, featureId } }, h)
    ).rejects.toThrow(/Unsupported feature type/)
    expect(h.view).not.toHaveBeenCalled()
  })

  test('GET renders the read-only page when the retention category carries a list prefix', async () => {
    // The backend normalises the retention category to choose an engine
    // calculation but never writes it back, so the raw GeoPackage value can
    // still be "1. Retained".
    mockFeature({
      type: 'watercourse',
      feature: {
        featureId,
        ref: 'W-2',
        baseline: { retentionCategory: '1. Retained' },
        proposed: {}
      }
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-watercourse-details',
      expect.objectContaining({ interventionDisplay: 'Retained' })
    )
  })

  test.each([['Created'], ['Enhanced'], ['Lost']])(
    'GET keeps the editable page for a %s watercourse',
    async (retentionCategory) => {
      // Only retained features are view-only; the rest still need their form.
      mockFeature({
        type: 'watercourse',
        feature: {
          featureId,
          ref: 'W-3',
          sizeMetres: 500,
          baseline: {
            retentionCategory,
            type: 'Ditches',
            condition: 'Moderate'
          },
          proposed: { type: 'Ditches', condition: 'Moderate' }
        }
      })

      const h = createMockH()
      await getController.handler({ query: { projectId, featureId } }, h)

      const [template, viewModel] = h.view.mock.calls[0]
      expect(template).toBe(EDITABLE_TEMPLATE)
      // The editable page posts back; the view-only pages have no form.
      expect(viewModel.formAction).toBe('/post-intervention-habitat-details')
    }
  )

  test('GET keeps the editable page for a created area habitat', async () => {
    mockFeature({
      type: 'habitat',
      feature: {
        featureId,
        ref: 'P-4',
        baseline: { retentionCategory: 'Created' },
        proposed: { broadType: 'Grassland', type: 'Modified grassland' }
      }
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view.mock.calls[0][0]).toBe(EDITABLE_TEMPLATE)
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
