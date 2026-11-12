import { wreck } from '../common/helpers/wreck-client.js'
import {
  baselineFeatureId,
  createMockH,
  featureId,
  isProjectUrl,
  mockFeature,
  projectId,
  projectPayload,
  projectWithBaselinePayload
} from './controller-test-helpers.js'

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
const { _resetCreatedAreaReferenceCache } =
  await import('./created-area-edit.js')

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
        // "Habitat" and the saved ref as the H1 (BMD-1180); the page name
        // becomes the section heading.
        heading: 'Habitat P-1',
        pageTitle: 'Habitat P-1',
        habitatDetailsSectionHeading: 'Post-intervention habitat details',
        habitatUnitsLabel: 'Habitat units delivered',
        caption: 'Test Project',
        habitatRef: 'P-1',
        interventionDisplay: 'Retained',
        sizeLabel: 'Size (hectares)',
        sizeDisplay: '2.5',
        broadHabitatDisplay: 'Grassland',
        habitatTypeDisplay: 'Modified grassland',
        distinctivenessDisplay: 'Low (2)',
        conditionDisplay: 'Good (3)',
        strategicSignificanceDisplay: 'Low (1)',
        habitatUnitsDisplay: '2.50',
        // Baseline feature resolved by ref, not the PI featureId.
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: `/projects/${projectId}/area-post-intervention`,
        // Retained, so the reference is editable (BMD-1180).
        errors: [],
        habitatRefInput: {
          id: 'habitatRef',
          value: 'P-1',
          error: undefined,
          maxLength: 99
        },
        refForm: {
          action: '/post-intervention-habitat-details',
          projectId,
          featureId,
          returnUrl: '',
          cancelHref: `/projects/${projectId}/area-post-intervention`
        }
      })
    )
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

  test.each([
    [
      'Retained',
      'habitat-details/pi-habitat-details',
      '0.004',
      'Size (hectares)'
    ],
    [
      'Created',
      'habitat-details/pi-habitat-details-enhanced',
      '0.004ha',
      undefined
    ],
    [
      'Enhanced',
      'habitat-details/pi-habitat-details-enhanced',
      '0.004ha',
      undefined
    ]
  ])(
    'GET shows a %s vertical area habitat on the area page, read only, sized in hectares',
    async (retentionCategory, template, sizeDisplay, sizeLabel) => {
      vi.mocked(wreck.get).mockImplementation((url) => {
        if (url.includes(`/post-intervention/features/${featureId}`)) {
          return Promise.resolve({
            payload: {
              type: 'verticalHabitat',
              feature: {
                featureId,
                ref: 'V-1',
                sizeSquareMetres: 40,
                units: 0.08,
                retentionCategory,
                proposed: {
                  broadType: 'Urban',
                  type: 'Facade-bound green wall',
                  condition: 'Poor'
                }
              }
            }
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
        template,
        expect.objectContaining({
          heading: 'V-1',
          sizeDisplay,
          broadHabitatDisplay: 'Urban',
          habitatTypeDisplay: 'Facade-bound green wall',
          backHref: `/projects/${projectId}/area-post-intervention`,
          // Created and Enhanced pages label every area habitat's size "Area".
          ...(sizeLabel && { sizeLabel })
        })
      )
    }
  )

  // A Medium urban tree point standing for 2 trees.
  function mockTree(retentionCategory, treeCreation) {
    _resetCreatedAreaReferenceCache()
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'tree',
            feature: {
              featureId,
              ref: 'T-1',
              retentionCategory,
              sizeSquareMetres: 326,
              count: 2,
              units: 0.13,
              proposed: {
                treeSize: 'Medium',
                type: 'Urban tree',
                broadType: 'Individual trees',
                condition: 'Moderate',
                strategicSignificance: 'Low',
                advanceYears: 0,
                delayYears: 0
              }
            }
          }
        })
      }
      if (url.endsWith('/reference/tree-creation') && treeCreation) {
        return treeCreation()
      }
      if (isProjectUrl(url)) {
        return Promise.resolve(projectPayload)
      }
      throw new Error(`Unexpected URL ${url}`)
    })
  }

  const treeCreationReference = () =>
    Promise.resolve({
      res: { statusCode: 200 },
      payload: {
        habitatTypes: ['Rural tree', 'Urban tree'].map((name) => ({
          name,
          broad: 'Individual trees',
          distinctiveness: 'Medium',
          distinctivenessScore: 4,
          difficulty: 'Low',
          difficultyMultiplier: 1,
          conditions: [
            { condition: 'Moderate', score: 2, years: 27 },
            { condition: 'Poor', score: 1, years: 10 }
          ]
        })),
        strategicSignificance: [
          { value: 'High', score: 1.15 },
          { value: 'Low', score: 1 }
        ],
        timeMultipliers: { 0: 1, 10: 0.7, 27: 0.382 }
      }
    })

  const treeRows = {
    caption: 'Test Project',
    interventionDisplay: expect.any(String),
    treeSizeDisplay: 'Medium',
    treeCountDisplay: '2',
    showTreeRows: true,
    backHref: `/projects/${projectId}/area-post-intervention`
  }

  test('GET renders an Enhanced individual tree read-only in the area layout, with its size class and number of trees', async () => {
    mockTree('Enhanced')

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-enhanced',
      expect.objectContaining({
        ...treeRows,
        heading: 'T-1',
        broadHabitatDisplay: 'Individual trees',
        habitatTypeDisplay: 'Urban tree'
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('refForm')
  })

  test('GET renders a Retained individual tree with its reference form, in the area layout', async () => {
    mockTree('Retained', treeCreationReference)

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details',
      expect.objectContaining({
        ...treeRows,
        heading: 'Habitat T-1',
        habitatTypeDisplay: 'Urban tree',
        refForm: expect.objectContaining({ featureId })
      })
    )
  })

  test('GET renders a Retained individual tree read-only while the backend cannot rename trees', async () => {
    mockTree('Retained', () =>
      Promise.reject(
        Object.assign(new Error('Not Found'), {
          output: { statusCode: 404 }
        })
      )
    )

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details',
      expect.objectContaining({ ...treeRows, habitatTypeDisplay: 'Urban tree' })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('refForm')
  })

  test('POST refuses to rename a Retained tree while the backend cannot rename trees', async () => {
    mockTree('Retained', () =>
      Promise.reject(
        Object.assign(new Error('Not Found'), {
          output: { statusCode: 404 }
        })
      )
    )

    await expect(
      postController.handler(
        { payload: { projectId, featureId, habitatRef: 'T-2' } },
        createMockH()
      )
    ).rejects.toMatchObject({ output: { statusCode: 501 } })
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test('GET renders a Created individual tree on the edit page, its broad habitat fixed and offered only Urban tree or Rural tree', async () => {
    mockTree('Created', treeCreationReference)

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-created-edit',
      expect.objectContaining({
        ...treeRows,
        fixedBroadHabitat: 'Individual trees',
        values: expect.objectContaining({ habitatType: 'Urban tree' })
      })
    )
    const { fields } = h.view.mock.calls[0][1]
    expect(fields).not.toHaveProperty('broadHabitat')
    expect(fields.habitatType.items.map((item) => item.value)).toEqual([
      'Rural tree',
      'Urban tree'
    ])
  })

  test('GET renders a Created individual tree read-only while the backend serves no tree reference', async () => {
    mockTree('Created', () =>
      Promise.reject(
        Object.assign(new Error('Not Found'), {
          output: { statusCode: 404 }
        })
      )
    )

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-enhanced',
      expect.objectContaining({
        ...treeRows,
        broadHabitatDisplay: 'Individual trees',
        habitatTypeDisplay: 'Urban tree'
      })
    )
  })

  test('GET sends an unsupported feature back to the return URL it was linked from', async () => {
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

    const returnUrl = `/projects/${projectId}/area-post-intervention`
    const h = createMockH()
    await getController.handler(
      { query: { projectId, featureId, returnUrl } },
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-feature-unsupported',
      expect.objectContaining({ backHref: returnUrl })
    )
  })

  test.each([
    ['unsafe', '//evil.example.com'],
    ['retired list', `/projects/${projectId}/post-intervention-habitat-list`]
  ])(
    'GET ignores a %s returnUrl and returns to the area page',
    async (_label, returnUrl) => {
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
      await getController.handler(
        { query: { projectId, featureId, returnUrl } },
        h
      )

      expect(h.view).toHaveBeenCalledWith(
        'habitat-details/pi-feature-unsupported',
        expect.objectContaining({
          backHref: `/projects/${projectId}/area-post-intervention`
        })
      )
    }
  )

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
        // "Hedgerow" and the saved ref as the H1 (BMD-1180).
        heading: 'Hedgerow HG-2',
        habitatDetailsSectionHeading: 'Post-intervention habitat details',
        habitatUnitsLabel: 'Habitat units delivered',
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
        backHref: `/projects/${projectId}/hedgerows-post-intervention`,
        habitatRefInput: expect.objectContaining({ value: 'HG-2' }),
        refForm: expect.objectContaining({
          cancelHref: `/projects/${projectId}/hedgerows-post-intervention`
        })
      })
    )
  })

  test('GET links to the baseline hedgerow when the baseline was saved before refs were cleaned (BMD-1058)', async () => {
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
              proposed: { type: 'Native hedgerow', condition: 'Moderate' }
            }
          }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve({
          payload: {
            project: {
              name: 'Test Project',
              baseline: {
                hedgerows: [{ featureId: baselineFeatureId, ref: '  HG-2 ' }]
              }
            }
          }
        })
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view.mock.calls[0][1].viewBaselineHref).toBe(
      `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
    )
  })

  describe('GET links "View baseline details" within the habitat’s own layer', () => {
    const otherBaselineId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

    function mockHedgerowWithBaseline(
      baseline,
      snapshot = {},
      type = 'hedgerow'
    ) {
      vi.mocked(wreck.get).mockImplementation((url) => {
        if (url.includes(`/post-intervention/features/${featureId}`)) {
          return Promise.resolve({
            payload: {
              type,
              feature: {
                featureId,
                ref: 'H1',
                retentionCategory: 'Retained',
                baseline: snapshot,
                proposed: {}
              }
            }
          })
        }
        if (isProjectUrl(url)) {
          return Promise.resolve({
            payload: { project: { name: 'Test Project', baseline } }
          })
        }
        throw new Error(`Unexpected URL ${url}`)
      })
    }

    async function linkedBaselineHref() {
      const h = createMockH()
      await getController.handler({ query: { projectId, featureId } }, h)
      return h.view.mock.calls[0][1].viewBaselineHref
    }

    test('links a hedgerow to the baseline hedgerow, not an area habitat sharing its ref', async () => {
      mockHedgerowWithBaseline({
        habitats: [{ featureId: otherBaselineId, ref: 'H1' }],
        hedgerows: [{ featureId: baselineFeatureId, ref: 'H1' }]
      })

      expect(await linkedBaselineHref()).toBe(
        `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
      )
    })

    test('links a vertical area habitat to the baseline vertical habitat, not an area habitat sharing its ref', async () => {
      mockHedgerowWithBaseline(
        {
          habitats: [{ featureId: otherBaselineId, ref: 'H1' }],
          verticalHabitats: [{ featureId: baselineFeatureId, ref: 'H1' }]
        },
        {},
        'verticalHabitat'
      )

      expect(await linkedBaselineHref()).toBe(
        `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
      )
    })

    test('shows no link when only another layer carries the ref', async () => {
      mockHedgerowWithBaseline({
        habitats: [{ featureId: otherBaselineId, ref: 'H1' }]
      })

      expect(await linkedBaselineHref()).toBeNull()
    })

    test('links the parcel the row’s baseline values describe where an import repeated the ref', async () => {
      mockHedgerowWithBaseline(
        {
          hedgerows: [
            { featureId: otherBaselineId, ref: 'H1', type: 'Native hedgerow' },
            {
              featureId: baselineFeatureId,
              ref: 'H1',
              type: 'Species-rich native hedgerow'
            }
          ]
        },
        { type: 'Species-rich native hedgerow' }
      )

      expect(await linkedBaselineHref()).toBe(
        `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
      )
    })

    test('falls back to the first parcel when the row’s values pick out none', async () => {
      mockHedgerowWithBaseline(
        {
          hedgerows: [
            { featureId: otherBaselineId, ref: 'H1', type: 'Native hedgerow' },
            { featureId: baselineFeatureId, ref: 'H1', type: 'Native hedgerow' }
          ]
        },
        { type: 'Native hedgerow' }
      )

      expect(await linkedBaselineHref()).toBe(
        `/baseline-habitat-details?featureId=${otherBaselineId}&projectId=${projectId}`
      )
    })
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
              retentionCategory: 'Retained',
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
        // "Watercourse" and the saved ref as the H1 (BMD-1180); the page
        // name becomes the section heading.
        heading: 'Watercourse W-1',
        habitatDetailsSectionHeading: 'Post-intervention habitat details',
        habitatUnitsLabel: 'Habitat units delivered',
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
        backHref: `/projects/${projectId}/watercourses-post-intervention`,
        habitatRefInput: expect.objectContaining({ value: 'W-1' }),
        refForm: expect.objectContaining({
          cancelHref: `/projects/${projectId}/watercourses-post-intervention`
        })
      })
    )
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
        body: [{ before: expect.stringContaining('not yet supported') }]
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
        retentionCategory: '1. Retained',
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

  test.each([['Lost']])(
    'GET renders the read-only page for a %s watercourse',
    async (retentionCategory) => {
      // Every PI feature is read-only regardless of retention category:
      // intervention type is not captured on import yet (BMD-534). Created
      // and Enhanced watercourses get their own two-section pages — see
      // controller-created-watercourse.test.js and
      // controller-enhanced-watercourse.test.js.
      mockFeature({
        type: 'watercourse',
        feature: {
          featureId,
          ref: 'W-3',
          sizeMetres: 500,
          retentionCategory,
          baseline: {
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

  test('GET renders the Created area details page for a created area habitat', async () => {
    mockFeature({
      type: 'habitat',
      feature: {
        featureId,
        ref: 'P-4',
        retentionCategory: 'Created',
        proposed: { broadType: 'Grassland', type: 'Modified grassland' }
      }
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-created-edit',
      expect.objectContaining({ interventionDisplay: 'Created' })
    )
  })

  test('GET renders the Created watercourse details page for a created watercourse', async () => {
    mockFeature({
      type: 'watercourse',
      feature: {
        featureId,
        ref: 'W-4',
        retentionCategory: 'Created',
        proposed: { type: 'Ditches' }
      }
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-created-edit',
      expect.objectContaining({ interventionDisplay: 'Created' })
    )
  })

  test('POST refuses edits for read-only retention categories', async () => {
    mockFeature({ type: 'habitat', feature: { retentionCategory: 'Enhanced' } })
    await expect(
      postController.handler(
        { payload: { projectId, featureId } },
        createMockH()
      )
    ).rejects.toMatchObject({ output: { statusCode: 501 } })
  })
})

test.each([
  ['habitat', 'Retained', 'habitat-details/pi-habitat-details'],
  ['habitat', 'Enhanced', 'habitat-details/pi-habitat-details-enhanced'],
  ['hedgerow', 'Retained', 'habitat-details/pi-hedgerow-details'],
  ['hedgerow', 'Enhanced', 'habitat-details/pi-hedgerow-details-enhanced']
])(
  'keeps legacy %s %s routing consistent with the shared retention resolver',
  async (type, retentionCategory, template) => {
    mockFeature({
      type,
      feature: {
        featureId,
        ref: 'Legacy',
        baseline: { retentionCategory },
        proposed: {}
      }
    })
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    expect(h.view).toHaveBeenCalledWith(
      template,
      expect.objectContaining({ interventionDisplay: retentionCategory })
    )
  }
)
