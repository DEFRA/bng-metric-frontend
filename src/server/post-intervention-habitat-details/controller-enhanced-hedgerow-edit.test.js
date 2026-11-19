import Boom from '@hapi/boom'
import { wreck } from '../common/helpers/wreck-client.js'
import {
  baselineFeatureId,
  createMockH,
  featureId,
  mockFeature,
  projectId,
  TEST_PROJECT_NAME
} from './controller-test-helpers.js'
import { enhancedHedgerowFeature } from './created-hedgerow-test-fixtures.js'

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
const READ_ONLY_TEMPLATE = 'habitat-details/pi-hedgerow-details-enhanced'
const HEDGEROWS_PAGE = `/projects/${projectId}/hedgerows-post-intervention`

function mockEnhanced(overrides = {}) {
  const feature = { ...structuredClone(enhancedHedgerowFeature), ...overrides }
  mockFeature(
    { type: 'hedgerow', feature },
    {
      payload: {
        project: {
          name: TEST_PROJECT_NAME,
          baseline: {
            hedgerows: [{ featureId: baselineFeatureId, ref: feature.ref }]
          }
        }
      }
    }
  )
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
    .filter((url) => url.includes('/reference/hedgerow-enhancement'))

function postRequest(overrides = {}, feature = enhancedHedgerowFeature) {
  const { broadHabitat: _none, ...values } = createdAreaValues(feature)
  return { payload: { projectId, featureId, ...values, ...overrides } }
}

describe('BMD-1046 Enhanced hedgerow edit page', () => {
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
        /\/reference\/hedgerow-enhancement\?type=Native\+hedgerow&condition=Moderate$/
      )
    ])
    expect(view).toMatchObject({
      interventionDisplay: 'Enhanced',
      sizeLabel: 'Size (kilometres)',
      sizeDisplay: '0.336',
      values: {
        ref: 'HG-E',
        habitatType: 'Native hedgerow',
        condition: 'Good',
        strategicSignificance: 'Low',
        advanceYears: '0',
        delayYears: '0'
      },
      fixedBroadHabitat: null,
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      cancelHref: HEDGEROWS_PAGE
    })
    expect(view.fields).not.toHaveProperty('broadHabitat')
    expect(optionValues(view.fields.habitatType)).toEqual([
      'Native hedgerow',
      'Species-rich native hedgerow'
    ])
    // Moderate is the baseline's own condition, so not an enhancement of it.
    expect(optionValues(view.fields.condition)).toEqual(['Good'])
    expect(view.fields.advanceYears.label).toBe(
      'Habitat created in advance (years)'
    )
    expect(view.fields.delayYears.label).toBe(
      'Delay in starting habitat creation (years)'
    )
    for (const field of [
      'habitatType',
      'condition',
      'strategicSignificance',
      'advanceYears',
      'delayYears'
    ]) {
      expect(view.fields[field].items[0].value).toBe('')
    }
    expect(view.uploadHref).toContain(projectId)
    // Its supporting information box is the Created hedgerow's (BMD-1190).
    expect(view.showCommentRow).toBe(true)
  })

  test('AC2: an incomplete hedgerow shows defaults and only the default target condition', async () => {
    mockEnhanced({
      units: 0,
      status: 'Incomplete',
      proposed: {
        type: null,
        condition: null,
        strategicSignificance: null,
        advanceYears: null,
        delayYears: null
      }
    })
    const view = await renderPage()

    expect(view.values).toMatchObject({ habitatType: '', condition: '' })
    expect(optionValues(view.fields.condition)).toEqual([])
    expect(view.habitatUnitsDisplay).toBe('0.00')
  })

  test('AC10 Scenario A: saves every editable value to the post-intervention hedgerow and returns to the Hedgerows tab', async () => {
    mockEnhanced()
    const h = createMockH()
    await postController.handler(
      postRequest({
        ref: ' Renamed ',
        habitatType: 'Species-rich native hedgerow',
        condition: 'Moderate',
        strategicSignificance: 'High',
        advanceYears: '0',
        delayYears: '3'
      }),
      h
    )

    expect(vi.mocked(wreck.put).mock.calls[0][0]).toMatch(
      `/projects/${projectId}/post-intervention/hedgerows/${featureId}`
    )
    expect(sentPayload()).toEqual({
      ref: 'Renamed',
      habitatType: 'Species-rich native hedgerow',
      condition: 'Moderate',
      strategicSignificance: 'High',
      advanceYears: '0',
      delayYears: '3'
    })
    expect(h.redirect).toHaveBeenCalledWith(HEDGEROWS_PAGE)
  })

  test('AC10 Scenario B: a cleared field is sent as null, not refused', async () => {
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
    'AC12: refuses %s, keeping what was entered and saving nothing',
    async (_name, overrides, summary) => {
      mockEnhanced()
      const h = createMockH()
      await postController.handler(postRequest(overrides), h)

      expect(wreck.put).not.toHaveBeenCalled()
      expect(h.view.mock.calls[0][0]).toBe(EDIT_TEMPLATE)
      const view = h.view.mock.calls[0][1]
      expect(view.errorList.map((e) => e.text)).toContain(summary)
      expect(view.values).toMatchObject(overrides)
    }
  )

  test('refuses a crafted target condition that is not a valid enhancement of the baseline', async () => {
    mockEnhanced()
    const h = createMockH()
    await postController.handler(postRequest({ condition: 'Moderate' }), h)

    expect(wreck.put).not.toHaveBeenCalled()
    expect(h.view.mock.calls[0][1].errors).toHaveProperty('condition')
  })

  // The PO's ruling (BMD-1046 testing): a stored choice the list does not
  // offer is not shown or kept. It shows the default option and a save clears it.
  const renamePost = (view) => {
    const { broadHabitat: _none, ...values } = view.values
    return { payload: { projectId, featureId, ...values, ref: 'Renamed' } }
  }
  const selectedValue = (field) =>
    field.items.find((item) => item.selected)?.value
  const pageText = (view) =>
    Object.values(view.fields)
      .flatMap((field) => [
        field.hint ?? '',
        ...field.items.map((item) => item.text)
      ])
      .join(' ')

  test('shows a stored habitat type the list no longer offers as the default option, and a rename clears it', async () => {
    mockEnhanced({
      proposed: {
        ...enhancedHedgerowFeature.proposed,
        type: 'Line of trees',
        condition: 'Good',
        distinctiveness: 'Low',
        distinctivenessScore: 2,
        difficulty: 'Low',
        difficultyMultiplier: 1,
        finalTimeToTargetCondition: '2 years (0.931225)'
      }
    })
    const view = await renderPage()
    expect(view.values).toMatchObject({ habitatType: '', condition: '' })
    expect(selectedValue(view.fields.habitatType)).toBe('')
    // AC2: with no habitat type, Target condition has only its default option.
    expect(optionValues(view.fields.condition)).toEqual([])
    expect(pageText(view)).not.toContain('imported value')
    expect(view).toMatchObject({
      distinctivenessDisplay: '',
      standardDifficultyDisplay: '',
      standardTimeToTargetDisplay: '',
      finalTimeToTargetDisplay: ''
    })

    vi.mocked(wreck.put).mockClear()
    await postController.handler(renamePost(view), createMockH())
    expect(sentPayload()).toMatchObject({
      ref: 'Renamed',
      habitatType: null,
      condition: null
    })
  })

  // The tester's AC2 case: HG032's strategic significance was rejected on
  // import, so the backend nulled it and recorded the rejected label.
  test('AC2: shows a significance rejected on import as the default option, and a rename clears it', async () => {
    mockEnhanced({
      ref: 'HG032',
      status: 'Incomplete',
      units: 0,
      proposed: {
        ...enhancedHedgerowFeature.proposed,
        strategicSignificance: null,
        strategicSignificanceCategory: null,
        strategicSignificanceScore: null,
        rejectedStrategicSignificance:
          'Location ecologically desirable but not in local strategy'
      }
    })
    const view = await renderPage()
    expect(view.values.strategicSignificance).toBe('')
    expect(selectedValue(view.fields.strategicSignificance)).toBe('')
    expect(view.fields.strategicSignificance.items[0]).toMatchObject({
      value: '',
      selected: true
    })
    expect(pageText(view)).not.toContain('imported value')
    expect(pageText(view)).not.toContain('Location ecologically desirable')

    vi.mocked(wreck.put).mockClear()
    await postController.handler(renamePost(view), createMockH())
    expect(sentPayload()).toMatchObject({
      ref: 'Renamed',
      strategicSignificance: null
    })
  })

  test('shows the condition error when the backend refuses the enhancement', async () => {
    mockEnhanced()
    const refused = Boom.badData('not a valid enhancement')
    refused.data = {
      res: { statusCode: 422 },
      payload: {
        statusCode: 422,
        error: 'Unprocessable Entity',
        message:
          'The proposed habitat is not a valid enhancement of its baseline',
        code: 'ENHANCEMENT_NOT_VALID',
        rule: 'offered-enhancement'
      }
    }
    vi.mocked(wreck.put).mockRejectedValue(refused)
    const h = { ...createMockH(), code: vi.fn().mockReturnThis() }
    await postController.handler(postRequest({ ref: 'Kept' }), h)

    expect(h.code).toHaveBeenCalledWith(422)
    const view = h.view.mock.calls[0][1]
    expect(view.errorList).toContainEqual({
      text: 'Choose a target condition that is a valid enhancement of the baseline habitat',
      href: '#condition'
    })
    expect(view.values.ref).toBe('Kept')
  })

  test('shows the read-only Enhanced page while the backend does not serve the hedgerow enhancement reference', async () => {
    mockEnhanced()
    const mocked = vi.mocked(wreck.get).getMockImplementation()
    vi.mocked(wreck.get).mockImplementation((url) =>
      url.includes('/reference/hedgerow-enhancement')
        ? Promise.reject(Boom.notFound())
        : mocked(url)
    )
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      READ_ONLY_TEMPLATE,
      expect.objectContaining({
        interventionDisplay: 'Enhanced',
        backHref: HEDGEROWS_PAGE
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('fields')
  })

  test('AC9: links a renamed hedgerow to the baseline it was renamed from, not by its new ref', async () => {
    const feature = {
      ...structuredClone(enhancedHedgerowFeature),
      ref: 'HG-E renamed',
      referenceEdited: true,
      parentFeatureId: baselineFeatureId
    }
    mockFeature(
      { type: 'hedgerow', feature },
      {
        payload: {
          project: {
            name: TEST_PROJECT_NAME,
            baseline: {
              hedgerows: [
                { featureId: baselineFeatureId, ref: 'HG-E' },
                {
                  featureId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
                  ref: 'HG-E renamed'
                }
              ]
            }
          }
        }
      }
    )
    const view = await renderPage()

    expect(view.viewBaselineHref).toBe(
      `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
    )
  })
})
