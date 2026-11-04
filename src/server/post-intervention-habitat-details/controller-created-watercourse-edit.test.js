import Boom from '@hapi/boom'
import { wreck } from '../common/helpers/wreck-client.js'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import {
  baselineFeatureId,
  createMockH,
  featureId,
  mockFeature,
  projectId
} from './controller-test-helpers.js'
import {
  createdWatercourseFeature as feature,
  watercourseCreationReference as reference
} from './created-watercourse-test-fixtures.js'
import {
  createdAreaValues,
  loadCreatedWatercourseReference,
  _resetCreatedAreaReferenceCache
} from './created-area-edit.js'
import { getController, postController } from './controller.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), put: vi.fn() }
}))
const { broadHabitat: _broad, ...values } = createdAreaValues(feature)
const request = (overrides = {}) => ({
  payload: { projectId, featureId, ...values, ...overrides }
})

beforeEach(() => {
  _resetCreatedAreaReferenceCache()
  mockFeature({ type: 'watercourse', feature })
  vi.mocked(wreck.put).mockResolvedValue({
    res: { statusCode: 200 },
    payload: {}
  })
})

test.each(
  ['watercourseEncroachment', 'riparianEncroachment'].flatMap((field) =>
    [undefined, null, 'not an array', {}].map((value) => [field, value])
  )
)(
  'rejects malformed %s reference data %j and retries the next request',
  async (field, value) => {
    wreck.get
      .mockResolvedValueOnce({ payload: { ...reference, [field]: value } })
      .mockResolvedValueOnce({ payload: reference })
    await expect(loadCreatedWatercourseReference()).rejects.toThrow(
      'Invalid watercourse creation reference response'
    )
    await expect(loadCreatedWatercourseReference()).resolves.toEqual(reference)
    expect(wreck.get).toHaveBeenCalledTimes(2)
  }
)

test('loads the Created watercourse form with independent saved encroachments and fixed length', async () => {
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  expect(h.view.mock.calls[0][0]).toBe(
    'habitat-details/pi-habitat-details-created-edit'
  )
  const vm = h.view.mock.calls[0][1]
  expect(vm).toMatchObject({
    sizeDisplay: '0.5km',
    sizeLabel: 'Length (km)',
    habitatUnitsDisplay: '2.24',
    cancelHref: `/projects/${projectId}/watercourses-post-intervention`
  })
  expect(vm.fields).not.toHaveProperty('broadHabitat')
  expect(vm.fields.habitatType.items.map((i) => i.value)).toEqual([
    '',
    'Canals',
    'Culvert',
    'Ditches'
  ])
  for (const field of ['watercourseEncroachment', 'riparianEncroachment']) {
    expect(vm.fields[field].items.map((i) => i.value)).toEqual([
      '',
      ...reference[field]
    ])
    expect(vm.fields[field].items.find((i) => i.selected).value).toBe(
      values[field]
    )
  }
})

test.each(['0', '30+', ''])(
  'saves both encroachments and timing %s to the watercourse endpoint',
  async (advanceYears) => {
    const h = createMockH()
    await postController.handler(
      request({
        ref: ' Renamed watercourse ',
        watercourseEncroachment: 'Major',
        riparianEncroachment: 'Minor/Minor',
        advanceYears
      }),
      h
    )
    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(`/post-intervention/watercourses/${featureId}`),
      expect.objectContaining({
        payload: JSON.stringify({
          ref: 'Renamed watercourse',
          habitatType: 'Ditches',
          condition: 'Moderate',
          strategicSignificance: 'Low',
          advanceYears: advanceYears || null,
          delayYears: '0',
          watercourseEncroachment: 'Major',
          riparianEncroachment: 'Minor/Minor'
        })
      })
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/watercourses-post-intervention`
    )
  }
)

test.each(['watercourseEncroachment', 'riparianEncroachment'])(
  'clears %s independently and keeps the other saved selection',
  async (field) => {
    await postController.handler(request({ [field]: '' }), createMockH())
    const payload = JSON.parse(wreck.put.mock.calls[0][1].payload)
    expect(payload[field]).toBeNull()
    const other =
      field === 'watercourseEncroachment'
        ? 'riparianEncroachment'
        : 'watercourseEncroachment'
    expect(payload[other]).toBe(values[other])
  }
)

test('retains every value and links both validation rules without saving', async () => {
  const h = createMockH()
  await postController.handler(
    request({ ref: ' ', advanceYears: '3', delayYears: '2' }),
    h
  )
  const vm = h.view.mock.calls[0][1]
  expect(vm.errorList.map((e) => e.href)).toEqual(['#ref', '#advanceYears'])
  expect(vm.values).toMatchObject({
    ref: ' ',
    advanceYears: '3',
    delayYears: '2',
    watercourseEncroachment: 'Minor',
    riparianEncroachment: 'Minor/No Encroachment'
  })
  expect(vm.errors.delayYears).toBe(vm.errors.advanceYears)
  expect(vm.finalTimeToTargetDisplay).toBe('')
  expect(wreck.put).not.toHaveBeenCalled()
})

test.each([
  { habitatType: 'Native hedgerow' },
  { habitatType: 'Culvert', condition: 'Good' },
  { watercourseEncroachment: 'Unknown' },
  { riparianEncroachment: 'Minor' },
  { ref: '\uD800' }
])(
  'rejects invalid reference or watercourse choices: %j',
  async (overrides) => {
    const h = createMockH()
    await postController.handler(request(overrides), h)
    expect(Object.keys(h.view.mock.calls[0][1].errors).length).toBeGreaterThan(
      0
    )
    expect(wreck.put).not.toHaveBeenCalled()
  }
)

test.each(['watercourseEncroachment', 'riparianEncroachment'])(
  'preserves an unsupported imported condition, timing and %s until explicitly cleared',
  async (encroachment) => {
    mockFeature({
      type: 'watercourse',
      feature: {
        ...feature,
        proposed: {
          ...feature.proposed,
          type: 'Culvert',
          condition: 'Good',
          advanceYears: 2.5,
          [encroachment]: 'Imported value'
        }
      }
    })
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    expect(h.view.mock.calls[0][1].values).toMatchObject({
      condition: 'unchanged',
      advanceYears: 'unchanged',
      [encroachment]: 'unchanged'
    })
    await postController.handler(
      request({
        habitatType: 'Culvert',
        condition: 'unchanged',
        advanceYears: 'unchanged',
        [encroachment]: 'unchanged'
      }),
      createMockH()
    )
    const payload = JSON.parse(wreck.put.mock.calls[0][1].payload)
    for (const field of ['condition', 'advanceYears', encroachment]) {
      expect(payload).not.toHaveProperty(field)
    }
  }
)

test('keeps a legacy Created watercourse editable and resolves only its own baseline layer', async () => {
  const legacy = structuredClone(feature)
  delete legacy.retentionCategory
  legacy.baseline.retentionCategory = 'Created'
  legacy.parentFeatureId = baselineFeatureId
  mockFeature(
    { type: 'watercourse', feature: legacy },
    {
      payload: {
        project: {
          baseline: {
            habitats: [{ featureId: baselineFeatureId }],
            watercourses: []
          }
        }
      }
    }
  )
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  expect(h.view.mock.calls[0][1].viewBaselineHref).toBeNull()
  expect(h.view.mock.calls[0][1].interventionDisplay).toBe('Created')
  expect(h.view.mock.calls[0][0]).toBe(
    'habitat-details/pi-habitat-details-created-edit'
  )
})

test('surfaces genuine reference failures and refuses a save during a rollout 404', async () => {
  const get = wreck.get.getMockImplementation()
  wreck.get.mockImplementation((url) =>
    url.endsWith('/reference/watercourse-creation')
      ? Promise.reject(Boom.serverUnavailable())
      : get(url)
  )
  await expect(
    getController.handler({ query: { projectId, featureId } }, createMockH())
  ).rejects.toThrow()
  _resetCreatedAreaReferenceCache()
  wreck.get.mockImplementation((url) =>
    url.endsWith('/reference/watercourse-creation')
      ? Promise.reject(Boom.notFound())
      : get(url)
  )
  await expect(
    postController.handler(request(), createMockH())
  ).rejects.toMatchObject({ output: { statusCode: 503 } })
  expect(wreck.put).not.toHaveBeenCalled()
})

describe('authenticated Created watercourse form', () => {
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
  test.each([
    { raw: 10 },
    { raw: '30+' },
    { raw: 5, editedAdvanceYears: 10 },
    { raw: 5, editedAdvanceYears: 30 },
    { raw: 10, editedAdvanceYears: null }
  ])('keeps an unchanged blank advance on a rename: %j', async (stored) => {
    const restricted = {
      ...feature,
      ...stored,
      properties: { 'Habitat created in advance/years': stored.raw },
      proposed: { ...feature.proposed, advanceYears: null }
    }
    mockFeature({ type: 'watercourse', feature: restricted })
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    const { broadHabitat: _broad, ...form } = h.view.mock.calls[0][1].values
    expect(form.advanceYears).toBe('')
    const { token: crumb, cookie } = await primeCrumb(server)
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      headers: { cookie },
      payload: {
        projectId,
        featureId,
        ...form,
        ref: 'Renamed watercourse',
        crumb
      }
    })
    expect(response.statusCode).toBe(302)
    const payload = JSON.parse(wreck.put.mock.calls[0][1].payload)
    expect(payload).not.toHaveProperty('advanceYears')
    expect(payload).toMatchObject({
      ref: 'Renamed watercourse',
      delayYears: '0'
    })
  })
  test.each([10, 30])(
    'explicitly clears a displayed advance of %s',
    async (advanceYears) => {
      mockFeature({
        type: 'watercourse',
        feature: { ...feature, proposed: { ...feature.proposed, advanceYears } }
      })
      const { token: crumb, cookie } = await primeCrumb(server)
      const response = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        auth,
        headers: { cookie },
        payload: { ...request({ advanceYears: '' }).payload, crumb }
      })
      expect(response.statusCode).toBe(302)
      expect(
        JSON.parse(wreck.put.mock.calls[0][1].payload).advanceYears
      ).toBeNull()
    }
  )
  test('requires CSRF and accepts the watercourse-specific shape with a valid token', async () => {
    const denied = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      payload: request().payload
    })
    expect(denied.statusCode).toBe(403)
    const { token: crumb, cookie } = await primeCrumb(server)
    const saved = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      headers: { cookie },
      payload: { ...request().payload, crumb }
    })
    expect(saved.statusCode).toBe(302)
    expect(saved.headers.location).toBe(
      `/projects/${projectId}/watercourses-post-intervention`
    )
  })
  test.each(['watercourseEncroachment', 'riparianEncroachment'])(
    'rejects an authenticated watercourse submission without %s',
    async (field) => {
      const { token: crumb, cookie } = await primeCrumb(server)
      const payload = request().payload
      delete payload[field]
      const response = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        auth,
        headers: { cookie },
        payload: { ...payload, crumb }
      })
      expect(response.statusCode).toBe(400)
      expect(wreck.put).not.toHaveBeenCalled()
    }
  )
  test('explains an unsupported imported type on the rendered read-only page and refuses a crafted save with 400', async () => {
    mockFeature({
      type: 'watercourse',
      feature: {
        ...feature,
        proposed: {
          ...feature.proposed,
          type: 'Legacy river type',
          condition: 'Legacy condition'
        }
      }
    })
    const response = await server.inject({
      method: 'GET',
      url: `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`,
      auth
    })
    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain(
      'This watercourse cannot be edited because its imported habitat type is not supported.'
    )
    expect(response.payload).toContain(
      'upload a new post-intervention file with a supported habitat type'
    )
    expect(response.payload).toContain('Legacy river type')
    expect(response.payload).not.toContain('id="habitatType"')
    const { token: crumb, cookie } = await primeCrumb(server)
    const refused = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      headers: { cookie },
      payload: { ...request().payload, crumb }
    })
    expect(refused.statusCode).toBe(400)
    expect(wreck.put).not.toHaveBeenCalled()
  })

  test.each([
    { strategicSignificance: 'Medium' },
    { strategicSignificance: 'Medium', strategicSignificanceCategory: 'Low' },
    { strategicSignificance: 'Low', rejectedStrategicSignificance: 'Medium' },
    {
      strategicSignificance:
        'Location ecologically desirable but not in local strategy'
    },
    { strategicSignificance: null, rejectedStrategicSignificance: 'Medium' },
    { strategicSignificance: 'Unknown' }
  ])(
    'preserves unsupported significance across a refused rename and reload: %j',
    async (stored) => {
      const original = {
        ...structuredClone(feature),
        proposed: {
          ...feature.proposed,
          strategicSignificanceCategory: null,
          strategicSignificanceScore: null,
          ...stored
        }
      }
      const snapshot = structuredClone(original)
      mockFeature({ type: 'watercourse', feature: original })
      const url = `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`
      const page = await server.inject({ method: 'GET', url, auth })
      expect(page.statusCode).toBe(200)
      expect(page.payload).toContain(
        'imported strategic significance is not supported'
      )
      expect(page.payload).toContain(
        stored.rejectedStrategicSignificance ?? stored.strategicSignificance
      )
      expect(page.payload).not.toContain('id="strategicSignificance"')
      expect(page.payload).not.toContain('name="ref"')
      expect(page.payload).not.toContain('>Save</button>')
      const { token: crumb, cookie } = await primeCrumb(server)
      const refused = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        auth,
        headers: { cookie },
        payload: { ...request({ ref: 'Renamed' }).payload, crumb }
      })
      expect(refused.statusCode).toBe(400)
      expect(wreck.put).not.toHaveBeenCalled()
      const reloaded = await server.inject({ method: 'GET', url, auth })
      expect(reloaded.payload).toContain(original.ref)
      expect(reloaded.payload).toContain(
        stored.rejectedStrategicSignificance ?? stored.strategicSignificance
      )
      expect(original).toEqual(snapshot)
    }
  )
})

test.each([
  ['Area/compensation not in local strategy/ no local strategy', 'Low'],
  ['Formally identified in local strategy', 'High'],
  [null, '']
])(
  'keeps supported or missing significance editable: %s',
  async (stored, expected) => {
    mockFeature({
      type: 'watercourse',
      feature: {
        ...feature,
        proposed: {
          ...feature.proposed,
          strategicSignificanceCategory: null,
          strategicSignificance: stored
        }
      }
    })
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    expect(h.view.mock.calls[0][0]).toBe(
      'habitat-details/pi-habitat-details-created-edit'
    )
    const vm = h.view.mock.calls[0][1]
    expect(vm.values.strategicSignificance).toBe(expected)
    const { broadHabitat: _unused, ...formValues } = vm.values
    await postController.handler(
      { payload: { projectId, featureId, ...formValues, ref: 'Renamed' } },
      h
    )
    expect(
      JSON.parse(wreck.put.mock.calls[0][1].payload).strategicSignificance
    ).toBe(expected || null)
  }
)

test('keeps an unsupported stored watercourse type read-only and refuses a crafted save', async () => {
  mockFeature({
    type: 'watercourse',
    feature: {
      ...feature,
      proposed: {
        ...feature.proposed,
        type: 'Legacy river type',
        condition: 'Legacy condition'
      }
    }
  })
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  expect(h.view.mock.calls[0][0]).toBe(
    'habitat-details/pi-watercourse-details-created'
  )
  expect(h.view.mock.calls[0][1].habitatTypeDisplay).toBe('Legacy river type')
  expect(h.view.mock.calls[0][1].readOnlyReason).toContain(
    'imported habitat type is not supported'
  )
  await expect(
    postController.handler(request(), createMockH())
  ).rejects.toMatchObject({ output: { statusCode: 400 } })
  expect(wreck.put).not.toHaveBeenCalled()
})

test('uses the selected habitat difficulty after a validation error even when the old reference difficulty matches', async () => {
  mockFeature({
    type: 'watercourse',
    feature: {
      ...feature,
      proposed: {
        ...feature.proposed,
        difficulty: 'Low',
        difficultyMultiplier: 1
      }
    }
  })
  const h = createMockH()
  await postController.handler(request({ ref: '', habitatType: 'Canals' }), h)
  expect(h.view.mock.calls[0][1]).toMatchObject({
    standardDifficultyDisplay: 'Medium',
    appliedDifficultyMultiplierDisplay: '0.67'
  })
  expect(wreck.put).not.toHaveBeenCalled()
})

test.each(['watercourseEncroachment', 'riparianEncroachment'])(
  'rejects unchanged for %s without an imported value',
  async (field) => {
    const other =
      field === 'watercourseEncroachment'
        ? 'riparianEncroachment'
        : 'watercourseEncroachment'
    mockFeature({
      type: 'watercourse',
      feature: {
        ...feature,
        proposed: { ...feature.proposed, [other]: 'Imported value' }
      }
    })
    const h = createMockH()
    await postController.handler(request({ [field]: 'unchanged' }), h)
    expect(h.view.mock.calls[0][1].errors[field]).toEqual(expect.any(String))
    expect(wreck.put).not.toHaveBeenCalled()
  }
)

test('shows conflicting imported timing, refuses it on Save, and accepts an explicit correction', async () => {
  mockFeature({
    type: 'watercourse',
    feature: {
      ...feature,
      proposed: {
        ...feature.proposed,
        advanceYears: 2.5,
        delayYears: 1.5,
        finalTimeToTargetCondition: 'stale imported calculation'
      }
    }
  })
  const loaded = createMockH()
  await getController.handler({ query: { projectId, featureId } }, loaded)
  expect(loaded.view.mock.calls[0][1].values).toMatchObject({
    advanceYears: 'unchanged',
    delayYears: 'unchanged'
  })
  expect(loaded.view.mock.calls[0][1].finalTimeToTargetDisplay).toBe('')
  const refused = createMockH()
  await postController.handler(
    request({
      ref: 'Rename only',
      advanceYears: 'unchanged',
      delayYears: 'unchanged'
    }),
    refused
  )
  expect(refused.view.mock.calls[0][1].errors).toMatchObject({
    advanceYears: expect.any(String),
    delayYears: expect.any(String)
  })
  expect(refused.view.mock.calls[0][1].values).toMatchObject({
    advanceYears: 'unchanged',
    delayYears: 'unchanged'
  })
  expect(wreck.put).not.toHaveBeenCalled()
  await postController.handler(
    request({ advanceYears: 'unchanged', delayYears: '' }),
    createMockH()
  )
  const payload = JSON.parse(wreck.put.mock.calls[0][1].payload)
  expect(payload).not.toHaveProperty('advanceYears')
  expect(payload.delayYears).toBeNull()
})
