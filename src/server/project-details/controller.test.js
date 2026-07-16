import Boom from '@hapi/boom'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { wreck } from '../common/helpers/wreck-client.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const authCredentials = {
  sub: 'test-user',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:3']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const url = `/project-details/${projectId}`
const mockProject = { project: { name: 'Greenfield Meadow Restoration' } }
const savedDetails = {
  localPlanningAuthority: 'Anytown Borough Council',
  surveyCompleters: 'Jane Smith',
  surveyCompletionDate: '01/06/2025',
  developmentType: 'Small site',
  nsips: 'No',
  applicant: 'Acme Developments Ltd'
}
const mockProjectWithDetails = {
  project: {
    name: 'Greenfield Meadow Restoration',
    details: savedDetails
  }
}

const { surveyCompletionDate: _savedDate, ...savedDetailsWithoutDate } =
  savedDetails
const savedDateFormFields = {
  'surveyCompletionDate-day': '01',
  'surveyCompletionDate-month': '06',
  'surveyCompletionDate-year': '2025'
}
const savedDetailsFormPayload = {
  ...savedDetailsWithoutDate,
  ...savedDateFormFields
}

// Mirrors what @hapi/wreck's get/post/patch/... shortcuts actually throw for
// a non-2xx response (see `_shortcut` in @hapi/wreck/lib/index.js) — a real
// backend error response, as opposed to a network-level failure.
function responseError(statusCode, payload = null) {
  const error = new Error(`Response Error: ${statusCode}`)
  error.data = { isResponseError: true, res: { statusCode }, payload }
  return error
}

describe('#projectDetailsController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProject
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns 200', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('govuk-heading-xl')
  })

  test('renders the back link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('govuk-back-link')
    expect(result).toContain(`/add-project-details/${projectId}`)
  })

  test('renders the project name caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('Greenfield Meadow Restoration')
  })

  test('renders without caption when project name is missing', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: {} }
    })
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toContain('govuk-caption-l')
  })

  test('renders a blank form when no details are persisted', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).not.toContain('Anytown Borough Council')
  })

  test('pre-fills the form with previously saved details', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProjectWithDetails
    })
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain('value="Anytown Borough Council"')
    expect(result).toContain('value="Jane Smith"')
    expect(result).toContain('value="Acme Developments Ltd"')
    // Date input: day/month/year pre-filled from the saved DD/MM/YYYY string
    expect(result).toMatch(/id="surveyCompletionDate-day"[^>]*value="01"/)
    expect(result).toMatch(/id="surveyCompletionDate-month"[^>]*value="06"/)
    expect(result).toMatch(/id="surveyCompletionDate-year"[^>]*value="2025"/)
    // Radios: checked attribute on the matching option
    expect(result).toMatch(/value="Small site"[^>]*checked/)
    expect(result).toMatch(/value="No"[^>]*checked/)
  })

  test('returns 404 when backend returns 404', async () => {
    vi.mocked(wreck.get).mockRejectedValue(responseError(404))
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns 502 when backend returns a non-2xx response', async () => {
    vi.mocked(wreck.get).mockRejectedValue(
      responseError(503, { error: 'Service Unavailable' })
    )
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('returns 502 when wreck throws', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Network failure'))
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('returns 502 when backend throws a boom error', async () => {
    vi.mocked(wreck.get).mockRejectedValue(Boom.gatewayTimeout('timeout'))
    const { statusCode } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })
})

describe('#projectDetailsController - validation', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('returns 400 when projectId is not a UUID', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/project-details/not-a-uuid',
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badRequest)
  })
})

describe('#projectDetailsController - authentication', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('redirects unauthenticated users', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url
    })
    expect(statusCode).toBe(statusCodes.redirect)
  })

  test('redirects users without bng completer role', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url,
      auth: {
        strategy: 'session',
        credentials: {
          sub: 'test-user',
          email: 'test@example.com',
          roles: ['aaa-bbb:other role:1']
        }
      }
    })
    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })
})

describe('#projectDetailsPostController', () => {
  let server
  let crumb

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(async () => {
    vi.mocked(wreck.patch).mockResolvedValue({
      res: { statusCode: 200 },
      payload: savedDetails
    })
    crumb = await primeCrumb(server)
  })

  afterEach(() => {
    vi.mocked(wreck.patch).mockReset()
    vi.restoreAllMocks()
  })

  test('PATCHes the backend with the submitted fields', async () => {
    await server.inject({
      method: 'POST',
      url,
      payload: { ...savedDetailsFormPayload, crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(wreck.patch).toHaveBeenCalledOnce()
    const [patchUrl, options] = vi.mocked(wreck.patch).mock.calls[0]
    const body = JSON.parse(options.payload)

    expect(patchUrl).toContain(`/projects/${projectId}/details`)
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(body).toEqual(savedDetails)
  })

  test('omits blank fields from the PATCH payload', async () => {
    await server.inject({
      method: 'POST',
      url,
      payload: {
        localPlanningAuthority: 'Anytown Borough Council',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    const [, options] = vi.mocked(wreck.patch).mock.calls[0]
    const body = JSON.parse(options.payload)

    expect(body).toEqual({ localPlanningAuthority: 'Anytown Borough Council' })
  })

  test('redirects to the project task list on success', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url,
      payload: { ...savedDetailsFormPayload, crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${projectId}`)
  })

  test('returns 404 when backend returns 404', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(responseError(404))
    const { statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: { ...savedDetailsFormPayload, crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns 502 when backend returns a non-2xx response', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(responseError(500))
    const { statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: { ...savedDetailsFormPayload, crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('returns 502 when wreck throws', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(new Error('Network failure'))
    const { statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: { ...savedDetailsFormPayload, crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('shows an error summary when the survey completion date is missing a day, without calling the backend', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: {
        'surveyCompletionDate-month': '6',
        'surveyCompletionDate-year': '2025',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('There is a problem')
    expect(result).toContain('Survey completion date must include a day')
    expect(result).toContain('href="#surveyCompletionDate-day"')
    expect(wreck.patch).not.toHaveBeenCalled()
  })

  test('shows an error summary when the survey completion date is missing day and month', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: {
        'surveyCompletionDate-year': '2025',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain(
      'Survey completion date must include day and month'
    )
  })

  test('shows an error summary when the survey completion date is not a real date, without calling the backend', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: {
        'surveyCompletionDate-day': '31',
        'surveyCompletionDate-month': '2',
        'surveyCompletionDate-year': '2025',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Survey completion date must be a real date')
    expect(wreck.patch).not.toHaveBeenCalled()
  })

  test('shows an error summary when the survey completion date is non-numeric', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: {
        'surveyCompletionDate-day': 'aa',
        'surveyCompletionDate-month': '6',
        'surveyCompletionDate-year': '2025',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Survey completion date must be a real date')
  })

  test('repopulates the form with submitted values on validation failure', async () => {
    const { result } = await server.inject({
      method: 'POST',
      url,
      payload: {
        localPlanningAuthority: 'Anytown Borough Council',
        'surveyCompletionDate-day': '31',
        'surveyCompletionDate-month': '2',
        'surveyCompletionDate-year': '2025',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(result).toContain('value="Anytown Borough Council"')
    expect(result).toMatch(/id="surveyCompletionDate-day"[^>]*value="31"/)
    expect(result).toMatch(/id="surveyCompletionDate-month"[^>]*value="2"/)
    expect(result).toMatch(/id="surveyCompletionDate-year"[^>]*value="2025"/)
    // Every part is highlighted for a "not a real date" error
    const dayInput = result.match(
      /<input[^>]*id="surveyCompletionDate-day"[^>]*>/
    )?.[0]
    expect(dayInput).toContain('govuk-input--error')
  })

  test('rejects an out-of-range development type value', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: { developmentType: 'Medium site', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(wreck.patch).not.toHaveBeenCalled()
  })

  test('succeeds with an entirely empty submission', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: { crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    const [, options] = vi.mocked(wreck.patch).mock.calls[0]
    expect(JSON.parse(options.payload)).toEqual({})
  })

  test('returns 400 when project id is not a UUID', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/project-details/not-a-uuid',
      payload: { crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('rejects POST with 403 when crumb is missing', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: savedDetails,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.forbidden)
  })

  test('redirects unauthenticated users', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url,
      payload: { crumb: crumb.token },
      headers: { cookie: crumb.cookie }
    })
    expect(statusCode).toBe(statusCodes.redirect)
  })
})
