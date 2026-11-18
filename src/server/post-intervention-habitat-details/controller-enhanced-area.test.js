import Boom from '@hapi/boom'
import { wreck } from '../common/helpers/wreck-client.js'
import {
  baselineFeatureId,
  createMockH,
  featureId,
  mockFeature,
  mockSectionAreaFeature,
  projectId,
  TEST_PROJECT_NAME
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
const READ_ONLY_TEMPLATE = 'habitat-details/pi-habitat-details-enhanced'

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

  // An Enhanced area's supporting information is not editable yet
  // (BMD-1190), though it shares the Created edit page (BMD-1153).
  test('has no supporting information box', async () => {
    mockEnhanced()
    const view = await renderPage()

    expect(view.showCommentRow).toBe(false)
    expect(view).not.toHaveProperty('commentInput')
  })

  test('neither checks nor sends a posted comment', async () => {
    mockEnhanced()
    const h = createMockH()
    await postController.handler(
      postRequest({ comment: `�${'a'.repeat(1000)}` }),
      h
    )

    expect(wreck.put).toHaveBeenCalledTimes(1)
    expect(sentPayload()).not.toHaveProperty('comment')
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/area-post-intervention`
    )
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

  test('AC1: labels Advance and Delay as the Created area does, as per Figma', async () => {
    mockEnhanced()
    const view = await renderPage()

    expect(view.fields.advanceYears.label).toBe(
      'Habitat created in advance (years)'
    )
    expect(view.fields.delayYears.label).toBe(
      'Delay in starting habitat creation (years)'
    )
  })

  test('shows the read-only Enhanced page while the backend does not serve the area enhancement reference', async () => {
    mockEnhanced()
    const mocked = vi.mocked(wreck.get).getMockImplementation()
    vi.mocked(wreck.get).mockImplementation((url) =>
      url.includes('/reference/area-enhancement?')
        ? Promise.reject(Boom.notFound())
        : mocked(url)
    )
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      READ_ONLY_TEMPLATE,
      expect.objectContaining({
        interventionDisplay: 'Enhanced',
        backHref: `/projects/${projectId}/area-post-intervention`
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('fields')
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
        code: 'ENHANCEMENT_NOT_VALID'
      }
    }
    vi.mocked(wreck.put).mockRejectedValue(refused)
    const h = { ...createMockH(), code: vi.fn().mockReturnThis() }
    await postController.handler(postRequest({ ref: 'Kept' }), h)

    expect(h.code).toHaveBeenCalledWith(422)
    expect(h.view.mock.calls[0][0]).toBe(EDIT_TEMPLATE)
    const view = h.view.mock.calls[0][1]
    expect(view.errors.condition.summary).toBe(
      'Choose a target condition that is a valid enhancement of the baseline habitat'
    )
    expect(view.errorList).toContainEqual({
      text: 'Choose a target condition that is a valid enhancement of the baseline habitat',
      href: '#condition'
    })
    expect(view.values.ref).toBe('Kept')
  })

  // A stored proposal its baseline's valid enhancements no longer list, such
  // as one saved before the baseline was edited: Urban is not offered at all.
  // The PO's ruling (BMD-1046 testing): it is not shown or kept, so each of its
  // choices shows the default option and a save clears it.
  const outOfListProposal = {
    broadType: 'Urban',
    type: 'Artificial unvegetated, unsealed surface',
    condition: 'N/A - Other',
    strategicSignificanceCategory: 'High',
    strategicSignificance: 'High',
    advanceYears: 0,
    delayYears: 2,
    distinctiveness: 'Very Low',
    distinctivenessScore: 0,
    finalTimeToTargetCondition: '2 years (0.93)'
  }

  const selectedValue = (field) =>
    field.items.find((item) => item.selected)?.value

  const renamePost = (view) => ({
    payload: { projectId, featureId, ...view.values, ref: 'E-1 renamed' }
  })

  test('shows a stored proposal the list no longer offers as the default options, with blank derived values', async () => {
    mockEnhanced({ proposed: outOfListProposal })
    const view = await renderPage()

    expect(view.values).toMatchObject({
      broadHabitat: '',
      habitatType: '',
      condition: '',
      strategicSignificance: 'High',
      advanceYears: '0',
      delayYears: '2'
    })
    for (const field of ['broadHabitat', 'habitatType', 'condition']) {
      expect(selectedValue(view.fields[field])).toBe('')
    }
    for (const field of Object.values(view.fields)) {
      expect(field.items.map((item) => item.text).join()).not.toContain(
        'imported value'
      )
      expect(field.hint ?? '').not.toContain('imported value')
    }
    expect(view).toMatchObject({
      distinctivenessDisplay: '',
      standardDifficultyDisplay: '',
      standardTimeToTargetDisplay: '',
      finalTimeToTargetDisplay: ''
    })
  })

  test('a rename clears a stored proposal the list no longer offers', async () => {
    mockEnhanced({ proposed: outOfListProposal })
    const view = await renderPage()
    const h = createMockH()
    await postController.handler(renamePost(view), h)

    expect(sentPayload()).toMatchObject({
      ref: 'E-1 renamed',
      broadType: null,
      habitatType: null,
      condition: null,
      strategicSignificance: 'High'
    })
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/area-post-intervention`
    )
  })

  test('clears only the condition when the stored broad habitat and type are still offered', async () => {
    mockEnhanced({
      proposed: { ...enhancedAreaFeature.proposed, condition: '3. Poor' }
    })
    const view = await renderPage()
    expect(view.values).toMatchObject({
      broadHabitat: 'Grassland',
      habitatType: 'Modified grassland',
      condition: ''
    })
    expect(selectedValue(view.fields.condition)).toBe('')

    await postController.handler(renamePost(view), createMockH())
    expect(sentPayload()).toMatchObject({
      broadType: 'Grassland',
      habitatType: 'Modified grassland',
      condition: null
    })
  })

  test('links a renamed habitat to the baseline it was renamed from, not by its new ref', async () => {
    const feature = {
      ...structuredClone(enhancedAreaFeature),
      ref: 'E-1 renamed',
      referenceEdited: true,
      parentFeatureId: baselineFeatureId
    }
    mockFeature(
      { type: 'habitat', feature },
      {
        payload: {
          project: {
            name: TEST_PROJECT_NAME,
            baseline: {
              habitats: [
                { featureId: baselineFeatureId, ref: 'E-1' },
                // Carries the new ref, so a join by ref would find it.
                {
                  featureId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
                  ref: 'E-1 renamed'
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
