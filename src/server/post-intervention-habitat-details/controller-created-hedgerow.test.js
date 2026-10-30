import { wreck } from '../common/helpers/wreck-client.js'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import {
  createMockH,
  featureId,
  projectId,
  isProjectUrl
} from './controller-test-helpers.js'
import {
  createdHedgerowFeature as feature,
  hedgerowCreationReference as reference
} from './created-hedgerow-test-fixtures.js'
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
  vi.mocked(wreck.get).mockImplementation(async (url) => {
    if (url.endsWith('/reference/hedgerow-creation')) {
      return { payload: reference }
    }
    if (url.includes('/post-intervention/features/')) {
      return { payload: { type: 'hedgerow', feature } }
    }
    if (isProjectUrl(url)) {
      return { payload: { project: { name: 'Test Project' } } }
    }
    throw new Error(`Unexpected URL ${url}`)
  })
  vi.mocked(wreck.put).mockResolvedValue({
    res: { statusCode: 200 },
    payload: {}
  })
})

test('loads editable hedgerow fields with fixed length and hedgerow list navigation', async () => {
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  const vm = h.view.mock.calls[0][1]
  expect(vm).toMatchObject({
    sizeLabel: 'Length (km)',
    sizeDisplay: '0.336km',
    interventionDisplay: 'Created',
    viewBaselineHref: null,
    cancelHref: `/projects/${projectId}/hedgerows-post-intervention`,
    habitatUnitsDisplay: '1.57'
  })
  expect(vm.fields).not.toHaveProperty('broadHabitat')
  expect(vm.fields.habitatType.items.map((i) => i.value)).toEqual([
    '',
    ...reference.habitatTypes.map((t) => t.name)
  ])
  expect(vm.fields.advanceYears.items).toHaveLength(33)
  expect(wreck.put).not.toHaveBeenCalled()
})

test.each(['0', '30+', ''])(
  'saves hedgerow fields including timing %s without a broad habitat',
  async (delayYears) => {
    const h = createMockH()
    await postController.handler(request({ ref: ' New hedge ', delayYears }), h)
    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(`/post-intervention/hedgerows/${featureId}`),
      expect.objectContaining({
        payload: JSON.stringify({
          ref: 'New hedge',
          habitatType: values.habitatType,
          condition: 'Good',
          strategicSignificance: 'Low',
          advanceYears: '0',
          delayYears: delayYears || null
        })
      })
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/hedgerows-post-intervention`
    )
  }
)

test('retains all invalid values, links errors and never saves a validation failure', async () => {
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
    delayYears: '2'
  })
  expect(vm.errors.delayYears).toBe(vm.errors.advanceYears)
  expect(vm.finalTimeToTargetDisplay).toBe('')
  expect(wreck.put).not.toHaveBeenCalled()
})

test.each(['\uD800', '\uFFFD'])(
  'rejects invalid UTF-8 reference %s',
  async (ref) => {
    const h = createMockH()
    await postController.handler(request({ ref }), h)
    expect(h.view.mock.calls[0][1].errors.ref).toBeDefined()
    expect(wreck.put).not.toHaveBeenCalled()
  }
)

test('does not accept area habitat types', async () => {
  const h = createMockH()
  await postController.handler(
    request({ habitatType: 'Modified grassland' }),
    h
  )
  expect(h.view.mock.calls[0][1].errors.habitatType).toContain('hedgerow')
  expect(wreck.put).not.toHaveBeenCalled()
})

describe('authenticated hedgerow form', () => {
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
  test('rejects POST without CSRF', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      payload: request().payload
    })
    expect(response.statusCode).toBe(403)
    expect(wreck.put).not.toHaveBeenCalled()
  })
  test('accepts a CSRF-protected hedgerow save with no broad habitat', async () => {
    const { token: crumb, cookie } = await primeCrumb(server)
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      headers: { cookie },
      payload: { ...request().payload, crumb }
    })
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(
      `/projects/${projectId}/hedgerows-post-intervention`
    )
  })
})
