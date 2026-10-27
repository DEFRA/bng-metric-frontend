import Boom from '@hapi/boom'
import { buildPostInterventionHabitatGrid } from '../common/helpers/post-intervention-habitat-grid.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import {
  baselineFeatureId,
  projectWithBaselinePayload,
  createMockH,
  featureId,
  mockFeature,
  projectId
} from './controller-test-helpers.js'
import {
  createdAreaFeature,
  creationReference
} from './created-area-test-fixtures.js'
import { createdAreaValues, validateCreatedArea } from './created-area-edit.js'
import { getController, postController } from './controller.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const values = createdAreaValues(createdAreaFeature)
const request = (overrides = {}) => ({
  payload: { projectId, featureId, ...values, ...overrides }
})

describe('Created area controller', () => {
  beforeEach(() => {
    mockFeature({
      type: 'habitat',
      feature: structuredClone(createdAreaFeature)
    })
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {}
    })
  })

  test('loads the editable page with saved selections', async () => {
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-created-edit',
      expect.objectContaining({
        formAction: '/post-intervention-habitat-details',
        values,
        habitatUnitsDisplay: '11.68',
        interventionDisplay: 'Created',
        cancelHref: `/projects/${projectId}/area-post-intervention`
      })
    )
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test('keeps the baseline link and safe list anchor on GET and validation redisplay', async () => {
    mockFeature(
      { type: 'habitat', feature: structuredClone(createdAreaFeature) },
      projectWithBaselinePayload
    )
    const returnUrl = `/projects/${projectId}/area-post-intervention#created`
    const h = createMockH()
    await getController.handler(
      { query: { projectId, featureId, returnUrl } },
      h
    )
    await postController.handler(request({ returnUrl, ref: ' ' }), h)
    for (const [, vm] of h.view.mock.calls) {
      expect(vm).toMatchObject({
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: returnUrl,
        cancelHref: returnUrl,
        returnUrl
      })
    }
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test.each([
    [
      `/projects/${projectId}/area-post-intervention#created`,
      `/projects/${projectId}/area-post-intervention#created`
    ],
    ['https://evil.example', `/projects/${projectId}/area-post-intervention`],
    ['//evil.example', `/projects/${projectId}/area-post-intervention`],
    [
      `/projects/${projectId}/hedgerow-post-intervention`,
      `/projects/${projectId}/area-post-intervention`
    ]
  ])('saves to the validated return URL %s', async (returnUrl, expected) => {
    const h = createMockH()
    await postController.handler(request({ returnUrl }), h)
    expect(h.redirect).toHaveBeenCalledWith(expected)
  })

  test('rejects a reference over the Unicode character limit without saving', async () => {
    const h = createMockH()
    await postController.handler(request({ ref: 'x'.repeat(101) }), h)
    expect(wreck.put).not.toHaveBeenCalled()
    expect(h.view.mock.calls[0][1].errors.ref).toContain(
      '100 characters or fewer'
    )
    expect(h.view.mock.calls[0][1].referenceHint).toBeNull()
    expect(
      validateCreatedArea(
        { ...values, ref: '\u{1F33F}'.repeat(100) },
        creationReference
      )
    ).toEqual({})
  })

  test.each([baselineFeatureId, null])(
    'uses the stored Created parent link after reference editing (%s)',
    async (parentFeatureId) => {
      mockFeature(
        {
          type: 'habitat',
          feature: {
            ...createdAreaFeature,
            ref: parentFeatureId ? 'Changed reference' : 'P-1',
            parentFeatureId
          }
        },
        projectWithBaselinePayload
      )
      const h = createMockH()
      await getController.handler({ query: { projectId, featureId } }, h)
      await postController.handler(request({ ref: ' ' }), h)
      for (const [, vm] of h.view.mock.calls) {
        expect(vm.viewBaselineHref).toBe(
          parentFeatureId
            ? `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
            : null
        )
      }
    }
  )

  test('saves all editable values and redirects to the area list', async () => {
    const h = createMockH()
    await postController.handler(
      request({
        ref: '  New reference  ',
        advanceYears: '0',
        delayYears: '30+'
      }),
      h
    )
    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(`/post-intervention/habitats/${featureId}`),
      expect.objectContaining({
        payload: JSON.stringify({
          ref: 'New reference',
          broadType: 'Grassland',
          habitatType: 'Modified grassland',
          condition: 'Good',
          strategicSignificance: 'Low',
          advanceYears: '0',
          delayYears: '30+'
        })
      })
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/area-post-intervention`
    )
  })

  test.each(['advanceYears', 'delayYears'])(
    'keeps saved 30+ %s visible on the list',
    async (field) => {
      await postController.handler(request({ [field]: '30+' }), createMockH())
      const saved = JSON.parse(wreck.put.mock.calls[0][1].payload)
      const grid = buildPostInterventionHabitatGrid({
        features: [
          {
            ...createdAreaFeature,
            proposed: {
              ...createdAreaFeature.proposed,
              ...saved,
              [field]: 30,
              [`${field}Is30Plus`]: true
            }
          }
        ],
        projectId,
        interventionType: 'Created',
        readSize: (feature) => feature.sizeSquareMetres,
        formatSize: String,
        formatSizeTotal: String
      })
      const label = field === 'advanceYears' ? 'Advance' : 'Delay'
      const column = grid.columns.findIndex((c) => c.text === label)
      expect(grid.habitatRows[0][column].text).toBe('30+ years')
    }
  )

  test('allows incomplete saves and sends null rather than default labels', async () => {
    await postController.handler(
      request({
        broadHabitat: '',
        habitatType: '',
        condition: '',
        strategicSignificance: '',
        advanceYears: '',
        delayYears: ''
      }),
      createMockH()
    )
    expect(JSON.parse(wreck.put.mock.calls[0][1].payload)).toEqual({
      ref: 'P-1',
      broadType: null,
      habitatType: null,
      condition: null,
      strategicSignificance: null,
      advanceYears: null,
      delayYears: null
    })
  })

  test('validation failures retain entered values and never save', async () => {
    const h = createMockH()
    await postController.handler(
      request({ ref: ' ', advanceYears: '2', delayYears: '3' }),
      h
    )
    expect(wreck.put).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-created-edit',
      expect.objectContaining({
        values: expect.objectContaining({
          ref: ' ',
          advanceYears: '2',
          delayYears: '3'
        }),
        errorList: [
          {
            href: '#ref',
            text: 'You have entered an invalid habitat reference.'
          },
          {
            href: '#advanceYears',
            text: 'A habitat cannot be created both in advance and with a delay.'
          }
        ]
      })
    )
  })

  test('rejects malformed references and crafted cross-broad habitat choices', () => {
    expect(
      validateCreatedArea({ ...values, ref: '\uD800' }, creationReference)
    ).toHaveProperty('ref')
    expect(
      validateCreatedArea(
        { ...values, broadHabitat: 'Urban' },
        creationReference
      )
    ).toHaveProperty('habitatType')
    expect(
      validateCreatedArea({ ...values, ref: 'é 🌿' }, creationReference)
    ).toEqual({})
  })

  test('supports correcting dependent choices without JavaScript and orders errors by the page', async () => {
    const h = createMockH()
    await postController.handler(
      request({
        ref: ' ',
        broadHabitat: 'Urban',
        strategicSignificance: 'Unknown',
        advanceYears: '2',
        delayYears: '3'
      }),
      h
    )
    const vm = h.view.mock.calls[0][1]
    expect(vm.errorList.map((error) => error.href)).toEqual([
      '#ref',
      '#habitatType',
      '#strategicSignificance',
      '#condition',
      '#advanceYears'
    ])
    expect(vm.errors.habitatType).toBe(
      'Choose a habitat type for the selected broad habitat'
    )
    expect(vm.errors.condition).toBe(
      'Choose a target condition for the selected habitat type'
    )
    expect(
      vm.fields.find((field) => field.id === 'habitatType').items
    ).toContainEqual(
      expect.objectContaining({ value: 'Developed land; sealed surface' })
    )
    expect(
      vm.fields.every((field) => !field.hint?.includes('imported value'))
    ).toBe(true)
    expect(wreck.put).not.toHaveBeenCalled()

    await postController.handler(
      request({
        broadHabitat: 'Urban',
        habitatType: 'Developed land; sealed surface',
        condition: 'N/A - Other'
      }),
      h
    )
    expect(wreck.put).toHaveBeenCalledOnce()
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/area-post-intervention`
    )
  })

  test('preserves canonical display wording when a reference error redisplays unchanged calculations', async () => {
    mockFeature({
      type: 'habitat',
      feature: {
        ...structuredClone(createdAreaFeature),
        baseline: { condition: '5. Poor' },
        proposed: {
          ...createdAreaFeature.proposed,
          standardTimeToTargetCondition: '7',
          finalTimeToTargetCondition: 'Saved final time label',
          difficultyMultiplier: 0.5
        }
      }
    })
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    await postController.handler(request({ ref: ' ' }), h)
    const initial = h.view.mock.calls[0][1]
    const redisplayed = h.view.mock.calls[1][1]
    expect(initial.standardTimeToTargetDisplay).toBe('Poor to Good - 7 years')
    for (const field of [
      'standardTimeToTargetDisplay',
      'finalTimeToTargetDisplay',
      'appliedDifficultyMultiplierDisplay'
    ]) {
      expect(redisplayed[field]).toBe(initial[field])
    }
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test('surfaces concurrent edit errors', async () => {
    vi.mocked(wreck.put).mockRejectedValue(Boom.conflict())
    await expect(
      postController.handler(request(), createMockH())
    ).rejects.toMatchObject({ output: { statusCode: 409 } })
  })
})

describe('Created area authenticated form', () => {
  let server
  const auth = {
    strategy: 'session',
    credentials: {
      sub: 'test-user',
      email: 'test@example.com',
      roles: ['aaa-bbb:bng completer:3']
    }
  }
  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => server.stop({ timeout: 0 }))
  beforeEach(() => {
    mockFeature({
      type: 'habitat',
      feature: structuredClone(createdAreaFeature)
    })
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {}
    })
  })

  test('rejects submission without a CSRF token', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      payload: request().payload
    })
    expect(response.statusCode).toBe(403)
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test('explains the limit without truncating a legacy imported reference on GET', async () => {
    const ref = 'x'.repeat(101)
    mockFeature({
      type: 'habitat',
      feature: { ...structuredClone(createdAreaFeature), ref }
    })
    const page = await server.inject({
      method: 'GET',
      url: `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`,
      auth
    })
    expect(page.statusCode).toBe(200)
    expect(page.payload).toContain(`value="${ref}"`)
    expect(page.payload).toContain(
      'This imported reference exceeds 100 characters.'
    )
    expect(page.payload).toContain(
      'Shorten it to 100 characters or fewer before saving.'
    )
    expect(page.payload).toContain('aria-describedby="ref-hint"')
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test('renders the CSRF token and saves a protected form submission', async () => {
    const { token, cookie } = await primeCrumb(server)
    const page = await server.inject({
      method: 'GET',
      url: `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`,
      auth,
      headers: { cookie }
    })
    expect(page.statusCode).toBe(200)
    expect(page.payload).toContain(`name="crumb" value="${token}"`)
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      headers: { cookie },
      payload: { ...request().payload, crumb: token }
    })
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(
      `/projects/${projectId}/area-post-intervention`
    )
  })
})
