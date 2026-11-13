import { wreck } from '../common/helpers/wreck-client.js'
import {
  baselineFeatureId,
  createMockH,
  featureId,
  mockSectionAreaFeature,
  projectId
} from './controller-test-helpers.js'
import { enhancedAreaFeature } from './created-area-test-fixtures.js'

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
const { _resetCreatedAreaReferenceCache, createdAreaValues } =
  await import('./created-area-edit.js')

const EDIT_TEMPLATE = 'habitat-details/pi-habitat-details-created-edit'

function mockEnhanced(overrides = {}) {
  const feature = { ...structuredClone(enhancedAreaFeature), ...overrides }
  mockSectionAreaFeature({
    ref: feature.ref,
    retentionCategory: feature.retentionCategory,
    baseline: feature.baseline,
    proposed: feature.proposed,
    sizeSquareMetres: feature.sizeSquareMetres,
    units: feature.units
  })
  return feature
}

async function renderPage() {
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  expect(h.view).toHaveBeenCalledWith(EDIT_TEMPLATE, expect.anything())
  return h.view.mock.calls[0][1]
}

const optionValues = (field) =>
  field.items.map((item) => item.value).filter(Boolean)

const sentPayload = () =>
  JSON.parse(vi.mocked(wreck.put).mock.calls[0][1].payload)

const enhancementCalls = () =>
  vi
    .mocked(wreck.get)
    .mock.calls.map(([url]) => url)
    .filter((url) => url.includes('/reference/area-enhancement'))

function postRequest(overrides = {}) {
  return {
    payload: {
      projectId,
      featureId,
      ...createdAreaValues(enhancedAreaFeature),
      ...overrides
    }
  }
}

describe('BMD-1045 Enhanced area edit page', () => {
  beforeEach(() => {
    _resetCreatedAreaReferenceCache()
    vi.mocked(wreck.get).mockReset()
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {}
    })
  })

  test('AC1: loads the edit page with the saved values and only the valid enhancements of the baseline', async () => {
    mockEnhanced()
    const view = await renderPage()

    expect(enhancementCalls()).toEqual([
      expect.stringMatching(
        /\/reference\/area-enhancement\?broadType=Grassland&type=Modified\+grassland&condition=Poor$/
      )
    ])
    expect(view).toMatchObject({
      interventionDisplay: 'Enhanced',
      formAction: '/post-intervention-habitat-details',
      habitatUnitsDisplay: '9.50',
      values: {
        ref: 'E-1',
        broadHabitat: 'Grassland',
        habitatType: 'Modified grassland',
        condition: 'Moderate',
        strategicSignificance: 'High',
        advanceYears: '0',
        delayYears: '2'
      },
      distinctivenessDisplay: 'Low (2)',
      standardDifficultyDisplay: 'Low',
      appliedDifficultyMultiplierDisplay: '1',
      standardTimeToTargetDisplay: 'Poor to Moderate - 10 years',
      finalTimeToTargetDisplay: '12 years (0.6534)',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      cancelHref: `/projects/${projectId}/area-post-intervention`
    })
    expect(view.uploadHref).toContain(projectId)
    // Urban has no valid enhancement of the baseline, so is not offered.
    expect(optionValues(view.fields.broadHabitat)).toEqual([
      'Grassland',
      'Heathland and shrub'
    ])
    expect(optionValues(view.fields.habitatType)).toEqual([
      'Modified grassland',
      'Other neutral grassland'
    ])
    // Poor is the baseline's own condition, so is not an enhancement of it.
    expect(optionValues(view.fields.condition)).toEqual(['Good', 'Moderate'])
    for (const field of [
      'broadHabitat',
      'habitatType',
      'condition',
      'strategicSignificance',
      'advanceYears',
      'delayYears'
    ]) {
      expect(view.fields[field].items[0].value).toBe('')
    }
    expect(optionValues(view.fields.advanceYears)).toHaveLength(32)
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test('AC2: an incomplete habitat shows defaults and blank derived values for the missing inputs', async () => {
    mockEnhanced({
      units: 0,
      status: 'Incomplete',
      proposed: {
        broadType: 'Grassland',
        type: null,
        condition: null,
        strategicSignificance: null,
        advanceYears: null,
        delayYears: null
      }
    })
    const view = await renderPage()

    expect(view).toMatchObject({
      habitatUnitsDisplay: '0.00',
      values: { broadHabitat: 'Grassland', habitatType: '', condition: '' },
      distinctivenessDisplay: '',
      standardDifficultyDisplay: '',
      standardTimeToTargetDisplay: '',
      finalTimeToTargetDisplay: ''
    })
    expect(optionValues(view.fields.condition)).toEqual([])
  })

  test('AC12: saves every editable value to the post-intervention area and returns to the Areas tab', async () => {
    mockEnhanced()
    const h = createMockH()
    await postController.handler(
      postRequest({
        ref: ' Renamed ',
        habitatType: 'Other neutral grassland',
        condition: 'Moderate',
        strategicSignificance: 'Low',
        advanceYears: '3',
        delayYears: '0'
      }),
      h
    )

    expect(vi.mocked(wreck.put).mock.calls[0][0]).toMatch(
      `/projects/${projectId}/post-intervention/habitats/${featureId}`
    )
    expect(sentPayload()).toEqual({
      ref: 'Renamed',
      broadType: 'Grassland',
      habitatType: 'Other neutral grassland',
      condition: 'Moderate',
      strategicSignificance: 'Low',
      advanceYears: '3',
      delayYears: '0'
    })
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/area-post-intervention`
    )
  })

  test('AC12 Scenario B: a cleared field is sent as null, not refused', async () => {
    mockEnhanced()
    await postController.handler(
      postRequest({ condition: '', strategicSignificance: '' }),
      createMockH()
    )
    expect(sentPayload()).toMatchObject({
      condition: null,
      strategicSignificance: null
    })
  })

  test.each([
    [
      'both an advance and a delay above zero',
      { advanceYears: '1', delayYears: '1' },
      'A habitat cannot be created both in advance and with a delay.'
    ],
    [
      'a blank reference',
      { ref: '   ' },
      'You have entered an invalid habitat reference.'
    ]
  ])(
    'AC14: refuses %s, keeping what was entered and saving nothing',
    async (_name, overrides, summary) => {
      mockEnhanced()
      const h = createMockH()
      await postController.handler(postRequest(overrides), h)

      expect(wreck.put).not.toHaveBeenCalled()
      const view = h.view.mock.calls[0][1]
      expect(h.view.mock.calls[0][0]).toBe(EDIT_TEMPLATE)
      expect(view.errorList.map((e) => e.text)).toContain(summary)
      expect(view.values).toMatchObject(overrides)
    }
  )

  test('refuses a crafted choice that is not a valid enhancement of the baseline', async () => {
    mockEnhanced()
    const h = createMockH()
    await postController.handler(postRequest({ condition: 'Poor' }), h)

    expect(wreck.put).not.toHaveBeenCalled()
    expect(h.view.mock.calls[0][1].errors).toHaveProperty('condition')
  })

  test('loads each baseline its own choices, once', async () => {
    mockEnhanced()
    await renderPage()
    await renderPage()
    mockEnhanced({
      baseline: { broadType: 'Cropland', type: 'Cereal crops', condition: '' }
    })
    await renderPage()

    expect(enhancementCalls()).toEqual([
      expect.stringContaining('condition=Poor'),
      expect.stringMatching(/broadType=Cropland&type=Cereal\+crops$/)
    ])
  })
})
