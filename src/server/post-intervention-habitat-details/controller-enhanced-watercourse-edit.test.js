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
import {
  enhancedWatercourseFeature,
  watercourseCreationReference
} from './created-watercourse-test-fixtures.js'

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
const READ_ONLY_TEMPLATE = 'habitat-details/pi-watercourse-details-enhanced'
const WATERCOURSES_PAGE = `/projects/${projectId}/watercourses-post-intervention`

function mockEnhanced(overrides = {}) {
  const feature = {
    ...structuredClone(enhancedWatercourseFeature),
    ...overrides
  }
  mockFeature(
    { type: 'watercourse', feature },
    {
      payload: {
        project: {
          name: TEST_PROJECT_NAME,
          baseline: {
            watercourses: [{ featureId: baselineFeatureId, ref: feature.ref }]
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

const selectedValue = (field) =>
  field.items.find((item) => item.selected)?.value

const sentPayload = () =>
  JSON.parse(vi.mocked(wreck.put).mock.calls[0][1].payload)

const enhancementCalls = () =>
  vi
    .mocked(wreck.get)
    .mock.calls.map(([url]) => url)
    .filter((url) => url.includes('/reference/watercourse-enhancement'))

function postRequest(overrides = {}, feature = enhancedWatercourseFeature) {
  const { broadHabitat: _none, ...values } = createdAreaValues(feature)
  return {
    payload: { projectId, featureId, comment: '', ...values, ...overrides }
  }
}

const EDITABLE_CHOICES = [
  'habitatType',
  'condition',
  'strategicSignificance',
  'watercourseEncroachment',
  'riparianEncroachment',
  'advanceYears',
  'delayYears'
]

describe('BMD-1047 Enhanced watercourse edit page', () => {
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
        /\/reference\/watercourse-enhancement\?type=Culvert&condition=Poor$/
      )
    ])
    expect(view).toMatchObject({
      interventionDisplay: 'Enhanced',
      sizeLabel: 'Size (kilometres)',
      sizeDisplay: '1.25',
      values: {
        ref: 'WC-E',
        habitatType: 'Ditches',
        condition: 'Moderate',
        strategicSignificance: 'Low',
        watercourseEncroachment: 'Minor',
        riparianEncroachment: 'Minor/No Encroachment',
        advanceYears: '0',
        delayYears: '0'
      },
      fixedBroadHabitat: null,
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      cancelHref: WATERCOURSES_PAGE
    })
    expect(view.fields).not.toHaveProperty('broadHabitat')
    // Culvert is never an enhanced habitat type.
    expect(optionValues(view.fields.habitatType)).toEqual(['Canals', 'Ditches'])
    expect(optionValues(view.fields.condition)).toEqual([
      'Good',
      'Fairly Good',
      'Moderate',
      'Fairly Poor',
      'Poor'
    ])
    // The encroachments are not restricted by the enhancement rules.
    expect(optionValues(view.fields.watercourseEncroachment)).toEqual(
      watercourseCreationReference.watercourseEncroachment
    )
    expect(optionValues(view.fields.riparianEncroachment)).toEqual(
      watercourseCreationReference.riparianEncroachment
    )
    expect(view.fields.advanceYears.label).toBe(
      'Habitat created in advance (years)'
    )
    expect(view.fields.delayYears.label).toBe(
      'Delay in starting habitat creation (years)'
    )
    for (const field of EDITABLE_CHOICES) {
      expect(view.fields[field].items[0].value).toBe('')
    }
    expect(view.uploadHref).toContain(projectId)
    // Its supporting information box is the Created watercourse's (BMD-1190).
    expect(view.showCommentRow).toBe(true)
  })

  test('AC2: an incomplete watercourse shows defaults, only the default target condition, and zero units', async () => {
    mockEnhanced({
      units: null,
      status: 'Incomplete',
      proposed: {
        type: null,
        condition: null,
        strategicSignificance: null,
        watercourseEncroachment: null,
        riparianEncroachment: null,
        advanceYears: null,
        delayYears: null
      }
    })
    const view = await renderPage()

    for (const field of EDITABLE_CHOICES) {
      expect(view.values[field]).toBe('')
      expect(selectedValue(view.fields[field])).toBe('')
    }
    expect(optionValues(view.fields.condition)).toEqual([])
    expect(view.habitatUnitsDisplay).toBe('0.00')
  })

  test('AC12 Scenario A: saves every editable value to the post-intervention watercourse and returns to the Watercourses tab', async () => {
    mockEnhanced()
    const h = createMockH()
    await postController.handler(
      postRequest({
        ref: ' Renamed ',
        habitatType: 'Canals',
        condition: 'Good',
        strategicSignificance: 'High',
        watercourseEncroachment: 'Major',
        riparianEncroachment: 'Major/Major',
        advanceYears: '0',
        delayYears: '3'
      }),
      h
    )

    expect(vi.mocked(wreck.put).mock.calls[0][0]).toMatch(
      `/projects/${projectId}/post-intervention/watercourses/${featureId}`
    )
    expect(sentPayload()).toMatchObject({
      ref: 'Renamed',
      habitatType: 'Canals',
      condition: 'Good',
      strategicSignificance: 'High',
      watercourseEncroachment: 'Major',
      riparianEncroachment: 'Major/Major',
      advanceYears: '0',
      delayYears: '3'
    })
    expect(h.redirect).toHaveBeenCalledWith(WATERCOURSES_PAGE)
  })

  test.each([
    ['strategic significance', { strategicSignificance: '' }],
    ['watercourse encroachment', { watercourseEncroachment: '' }],
    ['riparian encroachment', { riparianEncroachment: '' }]
  ])(
    'AC12 Scenario B: a cleared %s is sent as null, not refused',
    async (_name, overrides) => {
      mockEnhanced()
      await postController.handler(postRequest(overrides), createMockH())
      const [field] = Object.keys(overrides)
      expect(sentPayload()[field]).toBeNull()
    }
  )

  test('AC8 and AC9: clearing one encroachment keeps the other', async () => {
    mockEnhanced()
    await postController.handler(
      postRequest({ watercourseEncroachment: '' }),
      createMockH()
    )
    expect(sentPayload()).toMatchObject({
      watercourseEncroachment: null,
      riparianEncroachment: 'Minor/No Encroachment'
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
      expect(h.view.mock.calls[0][0]).toBe(EDIT_TEMPLATE)
      const view = h.view.mock.calls[0][1]
      expect(view.errorList.map((e) => e.text)).toContain(summary)
      expect(view.values).toMatchObject(overrides)
    }
  )

  test('refuses a crafted habitat type that is not a valid enhancement of the baseline', async () => {
    mockEnhanced()
    const h = createMockH()
    await postController.handler(
      postRequest({ habitatType: 'Culvert', condition: 'Poor' }),
      h
    )

    expect(wreck.put).not.toHaveBeenCalled()
    expect(h.view.mock.calls[0][1].errors).toHaveProperty('habitatType')
  })

  // The PO's ruling (BMD-1046 testing): a stored choice the list does not
  // offer is not shown or kept. It shows the default option and a save
  // clears it.
  test('shows a stored habitat type and encroachment the lists do not offer as the default option, and a rename clears them', async () => {
    mockEnhanced({
      proposed: {
        ...enhancedWatercourseFeature.proposed,
        type: 'Culvert',
        condition: 'Poor',
        watercourseEncroachment: 'Unknown'
      }
    })
    const view = await renderPage()
    expect(view.values).toMatchObject({
      habitatType: '',
      condition: '',
      watercourseEncroachment: '',
      riparianEncroachment: 'Minor/No Encroachment'
    })
    expect(selectedValue(view.fields.habitatType)).toBe('')
    expect(selectedValue(view.fields.watercourseEncroachment)).toBe('')
    expect(optionValues(view.fields.condition)).toEqual([])

    const { broadHabitat: _none, ...values } = view.values
    await postController.handler(
      { payload: { projectId, featureId, ...values, ref: 'Renamed' } },
      createMockH()
    )
    expect(sentPayload()).toMatchObject({
      ref: 'Renamed',
      habitatType: null,
      condition: null,
      watercourseEncroachment: null,
      riparianEncroachment: 'Minor/No Encroachment'
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

  test('shows the read-only Enhanced page while the backend does not serve the watercourse enhancement reference', async () => {
    mockEnhanced()
    const mocked = vi.mocked(wreck.get).getMockImplementation()
    vi.mocked(wreck.get).mockImplementation((url) =>
      url.includes('/reference/watercourse-enhancement')
        ? Promise.reject(Boom.notFound())
        : mocked(url)
    )
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      READ_ONLY_TEMPLATE,
      expect.objectContaining({
        interventionDisplay: 'Enhanced',
        backHref: WATERCOURSES_PAGE
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('fields')
  })

  test('does not restore a Created watercourse’s lineage advance for an Enhanced one', async () => {
    mockEnhanced()
    await postController.handler(
      postRequest({ advanceYears: '', delayYears: '0' }),
      createMockH()
    )
    expect(sentPayload().advanceYears).toBeNull()
  })
})
