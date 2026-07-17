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

const { getController } = await import('./controller.js')

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

/**
 * Mock the PI feature endpoint and the project endpoint.
 */
function mockFeature(featurePayload) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.includes(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({ payload: featurePayload })
    }
    if (isProjectUrl(url)) {
      return Promise.resolve(projectPayload)
    }
    throw new Error(`Unexpected URL ${url}`)
  })
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
              retentionCategory: 'Retained',
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
              retentionCategory: 'Retained',
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

  test('GET shows the unsupported-feature message for an unrecognised feature type', async () => {
    // Guards the fallback against a new feature type appearing without a
    // view-only page: it must never reach an editable form.
    mockFeature({ type: 'iggi', feature: { featureId, ref: 'I-1' } })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-feature-unsupported',
      expect.objectContaining({
        message: expect.stringContaining('not yet supported')
      })
    )
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
    'GET renders the read-only page for a %s watercourse',
    async (retentionCategory) => {
      // Every PI feature is read-only regardless of retention category:
      // intervention type is not captured on import yet (BMD-534), and the
      // intervention-specific pages arrive with BMD-845.
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
      expect(template).toBe('habitat-details/pi-watercourse-details')
      // The Intervention row shows the feature's actual category.
      expect(viewModel.interventionDisplay).toBe(retentionCategory)
      // View-only: no form action is passed to the template.
      expect(viewModel).not.toHaveProperty('formAction')
    }
  )

  test('GET renders the read-only page for a created area habitat', async () => {
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

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details',
      expect.objectContaining({ interventionDisplay: 'Created' })
    )
  })
})
