import Boom from '@hapi/boom'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

// BMD-1180: the reference of a Retained area habitat, hedgerow or watercourse
// is editable on its post-intervention details page.

const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const featureId = 'aa0e8400-e29b-41d4-a716-446655440001'
const baselineFeatureId = 'aa0e8400-e29b-41d4-a716-446655440002'
const pageUrl = `/post-intervention-habitat-details?featureId=${featureId}&projectId=${projectId}`
const saveUrl = `/projects/${projectId}/post-intervention/features/${featureId}`

const MAX_REF_LENGTH = 99

const FEATURES = {
  habitat: {
    featureId,
    ref: 'A1',
    sizeSquareMetres: 10_000,
    units: 4,
    retentionCategory: 'Retained',
    proposed: {
      broadType: 'Grassland',
      type: 'Modified grassland',
      condition: 'Poor',
      conditionScore: 1,
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  },
  hedgerow: {
    featureId,
    ref: 'H1',
    sizeMetres: 1000,
    units: 6,
    retentionCategory: 'Retained',
    proposed: {
      type: 'Native hedgerow',
      condition: 'Good',
      conditionScore: 3,
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  },
  watercourse: {
    featureId,
    ref: 'W1',
    sizeMetres: 500,
    units: 3,
    retentionCategory: 'Retained',
    baseline: { type: 'Ditches', condition: 'Good' },
    proposed: {
      type: 'Ditches',
      condition: 'Good',
      conditionScore: 3,
      distinctiveness: 'Medium',
      distinctivenessScore: 4
    }
  }
}

const LIST_ROUTES = {
  habitat: 'area-post-intervention',
  hedgerow: 'hedgerows-post-intervention',
  watercourse: 'watercourses-post-intervention'
}

function mockBackend({ type = 'habitat', feature = FEATURES[type] } = {}) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.endsWith(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({ payload: { type, feature } })
    }
    if (url.endsWith(`/projects/${projectId}`)) {
      return Promise.resolve({
        payload: {
          project: {
            name: 'Greenfield Meadow Restoration',
            baseline: {
              habitats: [{ featureId: baselineFeatureId, ref: 'A1' }]
            }
          }
        }
      })
    }
    return Promise.reject(new Error(`Unexpected URL ${url}`))
  })
}

function savedAs(type, ref) {
  return Promise.resolve({
    payload: { type, feature: { ...FEATURES[type], ref } }
  })
}

describe('#postInterventionHabitatDetails — retained habitat reference (BMD-1180)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  async function post(payload, { withCrumb = true } = {}) {
    const { token, cookie } = await primeCrumb(server)
    return server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      auth: authedAuth,
      headers: withCrumb ? { cookie } : {},
      payload: {
        projectId,
        featureId,
        ...payload,
        ...(withCrumb ? { crumb: token } : {})
      }
    })
  }

  describe('GET', () => {
    test.each([
      ['habitat', 'Habitat A1', 'A1'],
      ['hedgerow', 'Hedgerow H1', 'H1'],
      ['watercourse', 'Watercourse W1', 'W1']
    ])(
      'shows a retained %s’s reference in an input, with Save and Cancel',
      async (type, heading, ref) => {
        mockBackend({ type })

        const { statusCode, result } = await server.inject({
          method: 'GET',
          url: pageUrl,
          auth: authedAuth
        })

        expect(statusCode).toBe(statusCodes.ok)
        expect(result).toMatch(new RegExp(`<title>\\s*${heading} -`))
        expect(result).toContain(heading)
        expect(result).toContain('Habitat reference')
        expect(result).toMatch(
          new RegExp(
            `<input[^>]*id="habitatRef"[^>]*name="habitatRef"[^>]*value="${ref}"[^>]*maxlength="${MAX_REF_LENGTH}"`,
            's'
          )
        )
        expect(result).toContain('action="/post-intervention-habitat-details"')
        expect(result).toContain(`name="featureId" value="${featureId}"`)
        expect(result).toContain('Save')
        expect(result).toContain(
          `href="/projects/${projectId}/${LIST_ROUTES[type]}">Cancel`
        )
        expect(result).toContain('Post-intervention habitat details')
        expect(result).toContain('Habitat units delivered')
      }
    )

    test('keeps the return URL in the form, and Cancel goes back to it', async () => {
      mockBackend()
      const returnUrl = `/projects/${projectId}/area-post-intervention#row-3`

      const { result } = await server.inject({
        method: 'GET',
        url: `${pageUrl}&returnUrl=${encodeURIComponent(returnUrl)}`,
        auth: authedAuth
      })

      expect(result).toContain(`name="returnUrl" value="${returnUrl}"`)
      expect(result).toContain(`href="${returnUrl}">Cancel`)
    })

    test('keeps the View baseline details link', async () => {
      mockBackend()

      const { result } = await server.inject({
        method: 'GET',
        url: pageUrl,
        auth: authedAuth
      })

      expect(result).toContain(
        `/baseline-habitat-details?featureId=${baselineFeatureId}&amp;projectId=${projectId}`
      )
    })

    test('shows an Enhanced habitat read-only, with no reference input', async () => {
      mockBackend({
        feature: { ...FEATURES.habitat, retentionCategory: 'Enhanced' }
      })

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: pageUrl,
        auth: authedAuth
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toContain('id="habitatRef"')
      expect(result).not.toContain('habitat-details-form')
      expect(result).toContain('Enhanced')
    })

    test('shows the reference form for a retained parcel whose category an older import stored under baseline', async () => {
      const { retentionCategory: _root, ...legacy } = FEATURES.hedgerow
      mockBackend({
        type: 'hedgerow',
        feature: { ...legacy, baseline: { retentionCategory: '1. Retained' } }
      })

      const { result } = await server.inject({
        method: 'GET',
        url: pageUrl,
        auth: authedAuth
      })

      expect(result).toMatch(/<input[^>]*id="habitatRef"[^>]*value="H1"/s)
    })

    test('saves the reference of such a parcel', async () => {
      const { retentionCategory: _root, ...legacy } = FEATURES.hedgerow
      mockBackend({
        type: 'hedgerow',
        feature: { ...legacy, baseline: { retentionCategory: 'Retained' } }
      })
      vi.mocked(wreck.put).mockImplementation(() => savedAs('hedgerow', 'P-1'))

      const { statusCode } = await post({ habitatRef: 'P-1' })

      expect(statusCode).toBe(statusCodes.redirect)
    })

    test('shows a habitat with no retention category read-only', async () => {
      mockBackend({
        feature: { ...FEATURES.habitat, retentionCategory: undefined }
      })

      const { result } = await server.inject({
        method: 'GET',
        url: pageUrl,
        auth: authedAuth
      })

      expect(result).not.toContain('id="habitatRef"')
    })
  })

  describe('POST', () => {
    test.each(['habitat', 'hedgerow', 'watercourse'])(
      'saves a %s’s trimmed reference and returns to its list',
      async (type) => {
        mockBackend({ type })
        vi.mocked(wreck.put).mockImplementation(() => savedAs(type, 'P-1'))

        const { statusCode, headers } = await post({ habitatRef: '  P-1  ' })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/projects/${projectId}/${LIST_ROUTES[type]}`
        )
        const [url, options] = vi.mocked(wreck.put).mock.calls[0]
        expect(url).toMatch(new RegExp(`${saveUrl}$`))
        expect(JSON.parse(options.payload)).toEqual({ ref: 'P-1' })
      }
    )

    test.each([
      ['surrounding spaces', '  A1  ', '  A1  '],
      ['more than 99 characters', 'x'.repeat(120), 'x'.repeat(120)],
      ['characters that are not UTF-8', 'A\uFFFD1', 'A\uFFFD1'],
      ['no reference', null, ''],
      ['a line break the browser drops', 'A\n1', 'A1']
    ])(
      'saves nothing when a reference holding %s is left as it is',
      async (_label, storedRef, submitted) => {
        mockBackend({ feature: { ...FEATURES.habitat, ref: storedRef } })

        const { statusCode, headers } = await post({ habitatRef: submitted })

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(
          `/projects/${projectId}/${LIST_ROUTES.habitat}`
        )
        expect(wreck.put).not.toHaveBeenCalled()
      }
    )

    test('returns to the row it was opened from', async () => {
      mockBackend()
      vi.mocked(wreck.put).mockImplementation(() => savedAs('habitat', 'P-1'))
      const returnUrl = `/projects/${projectId}/area-post-intervention#row-3`

      const { headers } = await post({ habitatRef: 'P-1', returnUrl })

      expect(headers.location).toBe(returnUrl)
    })

    test('ignores a return URL that leaves the list', async () => {
      mockBackend()
      vi.mocked(wreck.put).mockImplementation(() => savedAs('habitat', 'P-1'))

      const { headers } = await post({
        habitatRef: 'P-1',
        returnUrl: 'https://example.com/elsewhere'
      })

      expect(headers.location).toBe(
        `/projects/${projectId}/area-post-intervention`
      )
    })

    test.each([
      ['blank', ''],
      ['whitespace only', '   '],
      ['not valid UTF-8', 'A�1']
    ])(
      'refuses a reference that is %s, showing the error and what was typed',
      async (_label, ref) => {
        mockBackend()

        const { statusCode, result } = await post({ habitatRef: ref })

        expect(statusCode).toBe(statusCodes.badRequest)
        expect(wreck.put).not.toHaveBeenCalled()
        expect(result).toMatch(/<title>\s*Error: Habitat A1 -/)
        expect(result).toContain('There is a problem')
        expect(result).toContain(
          '<a href="#habitatRef">You have entered an invalid habitat reference.</a>'
        )
        expect(result).toContain('Enter a valid habitat reference.')
        expect(result).toMatch(
          new RegExp(`<input[^>]*id="habitatRef"[^>]*value="${ref}"`, 's')
        )
      }
    )

    test('refuses a reference over 99 characters, asking the user to shorten it', async () => {
      mockBackend()
      const ref = 'x'.repeat(MAX_REF_LENGTH + 1)

      const { statusCode, result } = await post({ habitatRef: ref })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(wreck.put).not.toHaveBeenCalled()
      expect(result).toContain(
        '<a href="#habitatRef">Enter a habitat reference of 99 characters or fewer.</a>'
      )
      expect(result).toContain(
        'Enter a habitat reference of 99 characters or fewer.'
      )
      expect(result).toMatch(
        new RegExp(`<input[^>]*id="habitatRef"[^>]*value="${ref}"`, 's')
      )
    })

    test('saves a reference of 99 characters', async () => {
      mockBackend()
      const ref = 'x'.repeat(MAX_REF_LENGTH)
      vi.mocked(wreck.put).mockImplementation(() => savedAs('habitat', ref))

      const { statusCode } = await post({ habitatRef: ref })

      expect(statusCode).toBe(statusCodes.redirect)
      const [, options] = vi.mocked(wreck.put).mock.calls[0]
      expect(JSON.parse(options.payload)).toEqual({ ref })
    })

    test('keeps the heading on the saved reference when a save is refused', async () => {
      mockBackend()

      const { result } = await post({ habitatRef: ' ' })

      expect(result).toMatch(/<h1[^>]*>\s*Habitat A1\s*<\/h1>/)
    })

    test('refuses a POST without a CSRF token', async () => {
      mockBackend()

      const { statusCode } = await post(
        { habitatRef: 'P-1' },
        { withCrumb: false }
      )

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(wreck.put).not.toHaveBeenCalled()
    })

    test('refuses a POST with no reference field', async () => {
      mockBackend()

      const { statusCode } = await post({})

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(wreck.put).not.toHaveBeenCalled()
    })

    test('refuses a reference another habitat already uses, showing the error and what was typed', async () => {
      mockBackend()
      const inUse = Boom.badData('in use')
      inUse.data = {
        res: { statusCode: 422 },
        payload: { code: 'HABITAT_REF_IN_USE' }
      }
      vi.mocked(wreck.put).mockRejectedValue(inUse)

      const { statusCode, result } = await post({ habitatRef: 'A2' })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toMatch(/<title>\s*Error: Habitat A1 -/)
      expect(result).toContain(
        '<a href="#habitatRef">You have entered a habitat reference that is already in use.</a>'
      )
      expect(result).toContain(
        'Enter a habitat reference that is not already in use.'
      )
      expect(result).toMatch(/<input[^>]*id="habitatRef"[^>]*value="A2"/s)
    })

    test('refuses a save of a habitat holding a value saved before BMD-1175, naming the fields in the error summary', async () => {
      mockBackend()
      const stored = Boom.badData('stored value')
      stored.data = {
        res: { statusCode: 422 },
        payload: {
          statusCode: 422,
          error: 'Unprocessable Entity',
          message:
            'This habitat holds a value saved before the service checked text lengths and lists (proposed.condition, comment). Upload the file again, with the value corrected, to update it.',
          code: 'STORED_VALUE_NOT_ALLOWED'
        }
      }
      vi.mocked(wreck.put).mockRejectedValue(stored)

      const { statusCode, result } = await post({ habitatRef: 'A2' })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toMatch(/<title>\s*Error: Habitat A1 -/)
      expect(result).toMatch(
        /govuk-error-summary__list">\s*<li>\s*This habitat holds a value saved before the service checked text lengths and lists, in its proposed condition and comment\. Upload the file again, with the value corrected, to update this habitat\.\s*<\/li>/
      )
      expect(result).not.toContain('govuk-input--error')
      expect(result).toMatch(/<input[^>]*id="habitatRef"[^>]*value="A2"/s)
    })

    test('shows a reference the backend refuses at the field, keeping what was typed', async () => {
      mockBackend()
      vi.mocked(wreck.put).mockRejectedValue(Boom.badRequest('invalid ref'))

      const { statusCode, result } = await post({ habitatRef: 'P-1' })

      expect(statusCode).toBe(statusCodes.badRequest)
      expect(result).toContain('Enter a valid habitat reference.')
      expect(result).toMatch(/<input[^>]*id="habitatRef"[^>]*value="P-1"/s)
    })

    test('answers any other 422 from the backend as a refused save, not an upstream failure', async () => {
      mockBackend()
      vi.mocked(wreck.put).mockRejectedValue(Boom.badData('something else'))

      const { statusCode, result } = await post({ habitatRef: 'A2' })

      expect(statusCode).toBe(422)
      expect(result).toContain('Bad Request')
    })

    test.each([
      [Boom.conflict('locked'), statusCodes.conflict],
      [Boom.notFound('gone'), statusCodes.notFound],
      [Boom.internal('backend down'), statusCodes.badGateway]
    ])('answers a backend %s with %i', async (backendError, expectedStatus) => {
      mockBackend()
      vi.mocked(wreck.put).mockRejectedValue(backendError)

      const { statusCode } = await post({ habitatRef: 'P-1' })

      expect(statusCode).toBe(expectedStatus)
    })
  })
})
