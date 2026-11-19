import Boom from '@hapi/boom'
import { wreck } from '../common/helpers/wreck-client.js'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import {
  baselineFeatureId,
  mockFeature,
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
  loadCreatedHedgerowReference,
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
  expect(h.view.mock.calls[0][1].errors.habitatType.inline).toContain(
    'hedgerow'
  )
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
  // A hedgerow Created in its parent's own type is held by the backend to the
  // guide's steps for a habitat whose condition gets worse.
  test.each([
    [
      'degrade-worse-condition',
      'condition',
      'Choose a target condition lower than the baseline habitat&#39;s condition'
    ],
    [
      'degrade-advance-30-plus',
      'advanceYears',
      'Set the years in advance to 30+'
    ]
  ])(
    'shows the field to blame when the backend refuses the edit of a hedgerow whose condition gets worse (%s)',
    async (rule, field, wording) => {
      const refused = Boom.badData('does not follow the guide')
      refused.data = {
        res: { statusCode: 422 },
        payload: {
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: `The habitat is its baseline habitat created again in its own type, so it must be in a lower condition and created 30+ years in advance, or put back after a delay (rule ${rule})`,
          code: 'HABITAT_DEGRADE_NOT_VALID',
          rule
        }
      }
      vi.mocked(wreck.put).mockRejectedValue(refused)
      const { token: crumb, cookie } = await primeCrumb(server)

      const response = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        auth,
        headers: { cookie },
        payload: { ...request().payload, crumb }
      })

      expect(response.statusCode).toBe(422)
      expect(response.payload).toMatch(/<title>\s*Error: /)
      expect(response.payload).toContain(`href="#${field}"`)
      expect(response.payload).toContain(wording)
      expect(response.payload).toContain('cleared and put back')
      expect(response.payload).not.toContain('Newly Planted')
      expect(response.payload).toContain(`value="${values.ref}"`)
    }
  )

  test('shows the page again, naming the fields, when the backend refuses a hedgerow holding a value saved before BMD-1175', async () => {
    const stored = Boom.badData('stored value')
    stored.data = {
      res: { statusCode: 422 },
      payload: {
        statusCode: 422,
        error: 'Unprocessable Entity',
        message:
          'This habitat holds a value saved before the service checked text lengths and lists (baseline.condition, strategicSignificance). Upload the file again, with the value corrected, to update it.',
        code: 'STORED_VALUE_NOT_ALLOWED'
      }
    }
    vi.mocked(wreck.put).mockRejectedValue(stored)
    const { token: crumb, cookie } = await primeCrumb(server)
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth,
      headers: { cookie },
      payload: { ...request().payload, crumb }
    })
    expect(response.statusCode).toBe(400)
    expect(response.payload).toMatch(
      /govuk-error-summary__list">\s*<li>\s*This habitat holds a value saved before the service checked text lengths and lists, in its baseline condition and strategic significance\. Upload the file again, with the value corrected, to update this habitat\.\s*<\/li>/
    )
    expect(response.payload).not.toContain('govuk-input--error')
  })
})

test('uses the requested kind even when the reference response omits its discriminator', async () => {
  const { featureType: _kind, ...payload } = reference
  vi.mocked(wreck.get).mockResolvedValue({ payload })
  expect((await loadCreatedHedgerowReference()).featureType).toBe('hedgerow')
})

test('retains a non-template hedgerow parent link on GET and validation redisplay', async () => {
  mockFeature(
    {
      type: 'hedgerow',
      feature: { ...feature, parentFeatureId: baselineFeatureId }
    },
    {
      payload: {
        project: {
          name: 'Test Project',
          baseline: {
            hedgerows: [
              { featureId: baselineFeatureId, ref: 'Different reference' }
            ]
          }
        }
      }
    }
  )
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  await postController.handler(request({ ref: '' }), h)
  for (const [, vm] of h.view.mock.calls) {
    expect(vm.viewBaselineHref).toBe(
      `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
    )
  }
})

test('keeps Created hedgerows viewable until the backend reference endpoint is deployed', async () => {
  const get = vi.mocked(wreck.get).getMockImplementation()
  vi.mocked(wreck.get).mockImplementation((url) =>
    url.endsWith('/reference/hedgerow-creation')
      ? Promise.reject(Boom.notFound())
      : get(url)
  )
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  expect(h.view).toHaveBeenCalledWith(
    'habitat-details/pi-hedgerow-details-enhanced',
    expect.objectContaining({
      heading: 'H-1',
      backHref: `/projects/${projectId}/hedgerows-post-intervention`
    })
  )
  expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
})

test('keeps the baseline link on the Created hedgerow rollout fallback', async () => {
  mockFeature(
    {
      type: 'hedgerow',
      feature: { ...feature, parentFeatureId: baselineFeatureId }
    },
    {
      payload: {
        project: {
          name: 'Test Project',
          baseline: { hedgerows: [{ featureId: baselineFeatureId }] }
        }
      }
    }
  )
  const get = vi.mocked(wreck.get).getMockImplementation()
  vi.mocked(wreck.get).mockImplementation((url) =>
    url.endsWith('/reference/hedgerow-creation')
      ? Promise.reject(Boom.notFound())
      : get(url)
  )
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  expect(h.view.mock.calls[0][0]).toBe(
    'habitat-details/pi-hedgerow-details-enhanced'
  )
  expect(JSON.stringify(h.view.mock.calls[0][1])).toContain(baselineFeatureId)
})

test.each([
  ['edit page', false, 'habitat-details/pi-habitat-details-created-edit'],
  [
    'reference-unavailable fallback',
    true,
    'habitat-details/pi-hedgerow-details-enhanced'
  ]
])(
  'shows an incomplete Created hedgerow as 0.00 units delivered on the %s',
  async (_, referenceUnavailable, template) => {
    const incomplete = { ...feature, units: null, status: 'Incomplete' }
    vi.mocked(wreck.get).mockImplementation(async (url) => {
      if (url.endsWith('/reference/hedgerow-creation')) {
        if (referenceUnavailable) {
          throw Boom.notFound()
        }
        return { payload: reference }
      }
      if (url.includes('/post-intervention/features/')) {
        return { payload: { type: 'hedgerow', feature: incomplete } }
      }
      if (isProjectUrl(url)) {
        return { payload: { project: { name: 'Test Project' } } }
      }
      throw new Error(`Unexpected URL ${url}`)
    })
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    expect(h.view.mock.calls[0][0]).toBe(template)
    expect(h.view.mock.calls[0][1].habitatUnitsDisplay).toBe('0.00')
  }
)

test('does not hide genuine backend failures as a rollout fallback', async () => {
  vi.mocked(wreck.get).mockRejectedValue(Boom.serverUnavailable())
  await expect(
    getController.handler({ query: { projectId, featureId } }, createMockH())
  ).rejects.toThrow()
})

// The PO's ruling (BMD-1046 testing): a stored value the list does not offer
// is not shown or kept, so it shows the default option and a save clears it.
test.each([2.5, 31])(
  'shows imported timing %s as the default option, and a rename clears it',
  async (advanceYears) => {
    mockFeature({
      type: 'hedgerow',
      feature: {
        ...feature,
        proposed: {
          ...feature.proposed,
          advanceYears,
          finalTimeToTargetCondition: '4.5 years (0.8519)'
        }
      }
    })
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    const vm = h.view.mock.calls[0][1]
    expect(vm.values.advanceYears).toBe('')
    expect(vm.finalTimeToTargetDisplay).toBe('')
    expect(
      vm.fields.advanceYears.items.find((item) => item.selected).value
    ).toBe('')
    expect(
      vm.fields.advanceYears.items.map((item) => item.text).join()
    ).not.toContain('imported value')
    await postController.handler(
      request({ ref: 'Renamed hedge', advanceYears: vm.values.advanceYears }),
      h
    )
    const payload = JSON.parse(wreck.put.mock.calls[0][1].payload)
    expect(payload.ref).toBe('Renamed hedge')
    expect(payload.advanceYears).toBeNull()
  }
)

test('does not give a Created area a baseline link to a hedgerow parent', async () => {
  mockFeature(
    {
      type: 'habitat',
      feature: { ...feature, parentFeatureId: baselineFeatureId }
    },
    {
      payload: {
        project: {
          name: 'Test Project',
          baseline: {
            hedgerows: [{ featureId: baselineFeatureId, ref: feature.ref }]
          }
        }
      }
    }
  )
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  expect(h.view.mock.calls[0][1].viewBaselineHref).toBeNull()
})

test.each(['Moderate', 'Fairly Poor'])(
  'shows unavailable imported %s condition as the default option, and a rename clears it',
  async (condition) => {
    mockFeature({
      type: 'hedgerow',
      feature: { ...feature, proposed: { ...feature.proposed, condition } }
    })
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    const vm = h.view.mock.calls[0][1]
    expect(vm.values.condition).toBe('')
    expect(vm.fields.condition.items.find((item) => item.selected).value).toBe(
      ''
    )
    expect(
      vm.fields.condition.items.map((item) => item.text).join()
    ).not.toContain(condition)
    await postController.handler(
      request({ ref: 'Renamed hedge', condition: vm.values.condition }),
      createMockH()
    )
    expect(JSON.parse(wreck.put.mock.calls[0][1].payload).condition).toBeNull()
  }
)
