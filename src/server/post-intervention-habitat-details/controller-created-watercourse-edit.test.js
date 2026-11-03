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

test('preserves an unsupported imported condition, timing and encroachment until explicitly cleared', async () => {
  mockFeature({
    type: 'watercourse',
    feature: {
      ...feature,
      proposed: {
        ...feature.proposed,
        type: 'Culvert',
        condition: 'Good',
        advanceYears: 2.5,
        watercourseEncroachment: 'Imported value'
      }
    }
  })
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  expect(h.view.mock.calls[0][1].values).toMatchObject({
    condition: 'unchanged',
    advanceYears: 'unchanged',
    watercourseEncroachment: 'unchanged'
  })
  await postController.handler(
    request({
      habitatType: 'Culvert',
      condition: 'unchanged',
      advanceYears: 'unchanged',
      watercourseEncroachment: 'unchanged'
    }),
    createMockH()
  )
  const payload = JSON.parse(wreck.put.mock.calls[0][1].payload)
  for (const field of [
    'condition',
    'advanceYears',
    'watercourseEncroachment'
  ]) {
    expect(payload).not.toHaveProperty(field)
  }
})

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
})
