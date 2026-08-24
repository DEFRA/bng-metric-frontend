import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { fetchProject } from '../services/projects.js'
import {
  createHabitatListController,
  resolveBaselineDisplayFields,
  resolveProposedDisplayFields
} from './habitat-list-controller.js'
import { HABITAT_UPLOAD_TYPES } from './habitat-upload-types.js'
import {
  PI_FEATURE,
  PI_TREE_FEATURE
} from '../test-helpers/habitat-feature-fixtures.js'

vi.mock('../services/projects.js', () => ({
  fetchProject: vi.fn()
}))

const projectId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

describe('resolveBaselineDisplayFields', () => {
  it('returns type, distinctiveness and condition from top-level fields', () => {
    const result = resolveBaselineDisplayFields({
      featureId: 'aaaa',
      ref: 'P1',
      type: 'Lowland meadows',
      condition: 'Good',
      distinctiveness: 'V.High'
    })
    expect(result).toEqual({
      type: 'Lowland meadows',
      distinctiveness: 'V.High',
      condition: 'Good'
    })
  })

  it('returns null for missing top-level fields', () => {
    const result = resolveBaselineDisplayFields({ featureId: 'x', ref: 'P1' })
    expect(result).toEqual({
      type: null,
      distinctiveness: null,
      condition: null
    })
  })
})

describe('resolveProposedDisplayFields', () => {
  it('returns type, distinctiveness and condition from proposed sub-object', () => {
    const result = resolveProposedDisplayFields(PI_FEATURE)
    expect(result).toEqual({
      type: 'Developed land; sealed surface',
      distinctiveness: 'Low',
      condition: 'N/A - Other'
    })
  })

  it('does NOT return baseline type/condition even when proposed is absent', () => {
    const feature = structuredClone(PI_FEATURE)
    feature.proposed = undefined
    const result = resolveProposedDisplayFields(feature)
    expect(result).toEqual({
      type: null,
      distinctiveness: null,
      condition: null
    })
  })

  it('returns null for fields absent from proposed sub-object', () => {
    const feature = structuredClone(PI_FEATURE)
    feature.proposed = { type: 'Chalk stream' }
    const result = resolveProposedDisplayFields(feature)
    expect(result).toEqual({
      type: 'Chalk stream',
      distinctiveness: null,
      condition: null
    })
  })
})

const HEDGEROW_FEATURE = {
  featureId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  ref: 'HW1',
  sizeMetres: 200,
  units: 0.8,
  status: 'Complete',
  proposed: {
    type: 'Native hedge',
    condition: 'Good',
    distinctiveness: 'Medium'
  },
  baseline: {
    type: 'Native hedge',
    condition: 'Moderate',
    distinctiveness: 'Low'
  }
}

const WATERCOURSE_FEATURE = {
  featureId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  ref: 'WC1',
  sizeMetres: 120,
  units: 0.5,
  status: 'Complete',
  proposed: {
    type: 'Modified watercourse',
    condition: 'Moderate',
    distinctiveness: 'Medium'
  },
  baseline: {
    type: 'Chalk stream',
    condition: 'Good',
    distinctiveness: 'High'
  }
}

describe('createHabitatListController', () => {
  const uploadType = HABITAT_UPLOAD_TYPES.postIntervention
  const controller = createHabitatListController(uploadType)

  let h

  beforeEach(() => {
    h = { view: vi.fn().mockReturnThis() }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function callHandler() {
    return controller.handler({ params: { id: projectId } }, h)
  }

  it('uses proposed display fields and upload type flag in the view model', async () => {
    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          postIntervention: {
            habitatSizes: {
              areaHabitats: { totalSquareMetres: PI_FEATURE.sizeSquareMetres }
            },
            units: {
              habitatsTotal: PI_FEATURE.units,
              hedgerowsTotal: 0,
              watercoursesTotal: 0
            },
            habitats: [PI_FEATURE],
            hedgerows: [],
            watercourses: []
          }
        }
      }
    })

    await callHandler()

    expect(h.view).toHaveBeenCalledWith(
      uploadType.listView,
      expect.objectContaining({
        isPostIntervention: true,
        totalSizes: {
          site: '',
          areaHabitats: '0.785014ha',
          hedgerows: 'No data',
          watercourses: 'No data'
        },
        totalUnits: {
          areaHabitats: '3.14',
          hedgerows: 'No data',
          watercourses: 'No data'
        },
        habitatRows: [
          expect.arrayContaining([
            expect.objectContaining({
              text: 'Developed land; sealed surface'
            }),
            expect.objectContaining({ text: 'Low' }),
            expect.objectContaining({ text: 'N/A - Other' })
          ])
        ]
      })
    )
  })

  it('lists post-intervention trees as their own area-habitat rows using proposed fields', async () => {
    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          postIntervention: {
            habitatSizes: {
              areaHabitats: {
                totalSquareMetres:
                  PI_FEATURE.sizeSquareMetres + PI_TREE_FEATURE.sizeSquareMetres
              },
              site: { totalSquareMetres: PI_FEATURE.sizeSquareMetres }
            },
            units: { habitatsTotal: 0, treesTotal: PI_TREE_FEATURE.units },
            habitats: [PI_FEATURE],
            trees: [PI_TREE_FEATURE],
            hedgerows: [],
            watercourses: []
          }
        }
      }
    })

    await callHandler()

    const viewModel = h.view.mock.calls[0][1]
    // Parcel + tree => one row each, tree using its proposed habitat type.
    expect(viewModel.habitatRows).toHaveLength(2)
    expect(viewModel.habitatRows[1]).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: 'Urban tree' })])
    )
  })

  it('builds hedgerow rows from proposed fields', async () => {
    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          postIntervention: {
            habitatSizes: {
              hedgerows: { totalMetres: HEDGEROW_FEATURE.sizeMetres }
            },
            units: {
              habitatsTotal: 0,
              hedgerowsTotal: HEDGEROW_FEATURE.units,
              watercoursesTotal: 0
            },
            habitats: [],
            hedgerows: [HEDGEROW_FEATURE],
            watercourses: []
          }
        }
      }
    })

    await callHandler()

    expect(h.view).toHaveBeenCalledWith(
      uploadType.listView,
      expect.objectContaining({
        totalSizes: expect.objectContaining({ hedgerows: '0.2km' }),
        totalUnits: expect.objectContaining({ hedgerows: '0.80' }),
        hedgerowRows: [
          expect.arrayContaining([
            expect.objectContaining({ text: 'Native hedge' }),
            expect.objectContaining({ text: 'Medium' }),
            expect.objectContaining({ text: 'Good' })
          ])
        ]
      })
    )
  })

  it('uses the feature id as accessible link text when the ref is missing', async () => {
    const habitatWithoutRef = structuredClone(PI_FEATURE)
    habitatWithoutRef.ref = null
    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          postIntervention: {
            habitats: [habitatWithoutRef],
            hedgerows: [],
            watercourses: []
          }
        }
      }
    })

    await callHandler()

    expect(h.view.mock.calls[0][1].habitatRows[0][0]).toEqual(
      expect.objectContaining({
        text: habitatWithoutRef.featureId,
        attributes: {
          'data-sort-value': habitatWithoutRef.featureId
        }
      })
    )
  })

  it('uses feature presence when linear measurements have not been recorded', async () => {
    const hedgerowWithoutMeasurements = structuredClone(HEDGEROW_FEATURE)
    hedgerowWithoutMeasurements.sizeMetres = null
    hedgerowWithoutMeasurements.units = null

    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          postIntervention: {
            habitats: [],
            hedgerows: [hedgerowWithoutMeasurements],
            watercourses: [],
            habitatSizes: {
              hedgerows: { totalMetres: 0 },
              watercourses: { totalMetres: 0 }
            },
            units: { hedgerowsTotal: 0, watercoursesTotal: 0 }
          }
        }
      }
    })

    await callHandler()

    const viewModel = h.view.mock.calls[0][1]
    expect(viewModel.totalSizes).toEqual(
      expect.objectContaining({ hedgerows: '0km', watercourses: 'No data' })
    )
    expect(viewModel.totalUnits).toEqual(
      expect.objectContaining({ hedgerows: '0.00', watercourses: 'No data' })
    )
    expect(viewModel.postInterventionSummary.hedgerows.size).toBe('0.00km')
    expect(viewModel.postInterventionSummary.watercourses.size).toBe('No data')
    expect(viewModel.hedgerowRows[0][3].text).toBe('')
  })

  it('builds watercourse rows from proposed fields', async () => {
    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          postIntervention: {
            habitatSizes: {
              watercourses: { totalMetres: WATERCOURSE_FEATURE.sizeMetres }
            },
            units: {
              habitatsTotal: 0,
              hedgerowsTotal: 0,
              watercoursesTotal: WATERCOURSE_FEATURE.units
            },
            habitats: [],
            hedgerows: [],
            watercourses: [WATERCOURSE_FEATURE]
          }
        }
      }
    })

    await callHandler()

    expect(h.view).toHaveBeenCalledWith(
      uploadType.listView,
      expect.objectContaining({
        totalSizes: expect.objectContaining({ watercourses: '0.12km' }),
        totalUnits: expect.objectContaining({ watercourses: '0.50' }),
        watercourseRows: [
          expect.arrayContaining([
            expect.objectContaining({ text: 'Modified watercourse' }),
            expect.objectContaining({ text: 'Medium' }),
            expect.objectContaining({ text: 'Moderate' })
          ])
        ]
      })
    )
  })

  it('inserts the persisted intervention type between the ref and habitat type cells for post-intervention rows', async () => {
    const enhancedHabitat = structuredClone(PI_FEATURE)
    enhancedHabitat.retentionCategory = 'Enhanced'
    const enhancedHedgerow = structuredClone(HEDGEROW_FEATURE)
    enhancedHedgerow.retentionCategory = '2. Created'
    const enhancedWatercourse = structuredClone(WATERCOURSE_FEATURE)
    // No retention category persisted => defaults to "Retained".
    delete enhancedWatercourse.retentionCategory

    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          postIntervention: {
            habitats: [enhancedHabitat],
            hedgerows: [enhancedHedgerow],
            watercourses: [enhancedWatercourse]
          }
        }
      }
    })

    await callHandler()

    const viewModel = h.view.mock.calls[0][1]
    // Row shape: [ref, intervention type, habitat type, size, ...]. The
    // intervention type sits in the second cell and the ref link is untouched.
    expect(viewModel.habitatRows[0][1]).toEqual({ text: 'Enhanced' })
    expect(viewModel.habitatRows[0][0]).toEqual(
      expect.objectContaining({ text: 'H1-1' })
    )
    expect(viewModel.habitatRows[0][2]).toEqual({
      text: 'Developed land; sealed surface'
    })
    // Normalises a "N. " list prefix from the raw category.
    expect(viewModel.hedgerowRows[0][1]).toEqual({ text: 'Created' })
    // Defaults to "Retained" when no category is persisted.
    expect(viewModel.watercourseRows[0][1]).toEqual({ text: 'Retained' })
  })

  it('omits the intervention type cell for baseline rows', async () => {
    const baselineController = createHabitatListController(
      HABITAT_UPLOAD_TYPES.baseline
    )
    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          baseline: {
            habitats: [
              {
                featureId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                ref: 'P1',
                type: 'Lowland meadows',
                sizeSquareMetres: 1000,
                units: 5,
                status: 'Complete'
              }
            ],
            hedgerows: [],
            watercourses: []
          }
        }
      }
    })

    await baselineController.handler({ params: { id: projectId } }, h)

    const viewModel = h.view.mock.calls[0][1]
    // Baseline row shape: [ref, habitat type, size, ...] — no intervention cell.
    expect(viewModel.habitatRows[0][1]).toEqual({ text: 'Lowland meadows' })
  })

  it('passes null rows when project data is absent', async () => {
    vi.mocked(fetchProject).mockResolvedValue(null)

    await callHandler()

    expect(h.view).toHaveBeenCalledWith(
      uploadType.listView,
      expect.objectContaining({
        habitatRows: null,
        hedgerowRows: null,
        watercourseRows: null,
        caption: 'Project'
      })
    )
  })

  it('shows an empty area-habitats units cell (not "0.00") when units are not yet calculated', async () => {
    vi.mocked(fetchProject).mockResolvedValue({
      statusCode: 200,
      payload: {
        project: {
          name: 'Test Project',
          postIntervention: {
            habitatSizes: {
              areaHabitats: { totalSquareMetres: PI_FEATURE.sizeSquareMetres }
            },
            // No `units` field — project has not been enriched yet.
            habitats: [PI_FEATURE],
            hedgerows: [],
            watercourses: []
          }
        }
      }
    })

    await callHandler()

    expect(h.view).toHaveBeenCalledWith(
      uploadType.listView,
      expect.objectContaining({
        totalUnits: expect.objectContaining({ areaHabitats: '' })
      })
    )
  })
})
