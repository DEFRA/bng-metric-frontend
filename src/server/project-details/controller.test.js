import Boom from '@hapi/boom'
import { fetchLocalPlanningAuthorities } from '../common/services/local-planning-authorities.js'

vi.mock('../common/services/local-planning-authorities.js', () => ({
  fetchLocalPlanningAuthorities: vi.fn()
}))
beforeEach(() => {
  vi.mocked(fetchLocalPlanningAuthorities).mockResolvedValue([
    { name: 'Anytown Borough Council', reference: 'E60000001' }
  ])
})

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
const summaryUrl = `/projects/${projectId}/project-summary`
const areaSummaryUrl = `/projects/${projectId}/area-summary`
const projectName = 'Greenfield Meadow Restoration'
const mockProject = { project: { name: projectName } }
const savedDetails = {
  localPlanningAuthority: 'Anytown Borough Council',
  localPlanningAuthorityReference: 'E60000001',
  surveyCompleters: 'Jane Smith',
  surveyCompletionDate: '01/06/2025',
  applicant: 'Acme Developments Ltd',
  planningApplicationReference: '24/01234/FUL',
  planningApplicationType: 'Outline planning permission'
}
const mockProjectWithDetails = {
  project: { name: projectName, details: savedDetails }
}

const formPayload = {
  projectName,
  surveyCompleters: 'Jane Smith',
  'surveyCompletionDate-day': '01',
  'surveyCompletionDate-month': '06',
  'surveyCompletionDate-year': '2025',
  applicant: 'Acme Developments Ltd',
  localPlanningAuthorityReference: 'E60000001',
  planningApplicationReference: '24/01234/FUL',
  planningApplicationType: 'Outline planning permission',
  returnUrl: areaSummaryUrl
}
const expectedPatch = {
  name: projectName,
  surveyCompleters: 'Jane Smith',
  applicant: 'Acme Developments Ltd',
  localPlanningAuthorityReference: 'E60000001',
  planningApplicationReference: '24/01234/FUL',
  planningApplicationType: 'Outline planning permission',
  surveyCompletionDate: '01/06/2025'
}

// Mirrors what @hapi/wreck's get/post/patch/... shortcuts actually throw for
// a non-2xx response (see `_shortcut` in @hapi/wreck/lib/index.js) — a real
// backend error response, as opposed to a network-level failure.
function responseError(statusCode, payload = null) {
  const error = new Error(`Response Error: ${statusCode}`)
  error.data = { isResponseError: true, res: { statusCode }, payload }
  return error
}

function inputValue(html, id) {
  const match = new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(html)
  return /value="([^"]*)"/.exec(match?.[0] ?? '')?.[1] ?? ''
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

  test('AC2 renders the heading, help text, fields in order and CTAs', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain(
      '<h1 class="govuk-heading-xl">Project details</h1>'
    )
    expect(result).toContain(
      'Enter the details for the project. You do not need to add them all'
    )
    const labels = [
      'Project name',
      'Survey completed by',
      'Survey date',
      'Planning permission applicant name',
      'Local planning authority',
      'Planning application reference (optional)',
      'Planning application type (optional)'
    ]
    const positions = labels.map((label) => result.indexOf(`${label}\n`))
    expect(positions.every((position) => position > 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(result).toContain('Choose local planning authority')
    expect(result).toMatch(/<button[^>]*>\s*Save\s*<\/button>/)
    expect(result).toContain(
      `<a class="govuk-link" href="${summaryUrl}">Cancel</a>`
    )
    expect(result).not.toContain('govuk-error-summary')
  })

  test('AC2 pre-fills only the project name when nothing else is saved', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(inputValue(result, 'projectName')).toBe(projectName)
    for (const id of [
      'surveyCompleters',
      'surveyCompletionDate-day',
      'surveyCompletionDate-month',
      'surveyCompletionDate-year',
      'applicant',
      'planningApplicationReference',
      'planningApplicationType'
    ]) {
      expect(inputValue(result, id)).toBe('')
    }
    expect(result).toMatch(/<option value="" selected>/)
  })

  test('AC3 pre-fills every saved detail', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProjectWithDetails
    })
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(inputValue(result, 'surveyCompleters')).toBe('Jane Smith')
    expect(inputValue(result, 'surveyCompletionDate-day')).toBe('01')
    expect(inputValue(result, 'surveyCompletionDate-month')).toBe('06')
    expect(inputValue(result, 'surveyCompletionDate-year')).toBe('2025')
    expect(inputValue(result, 'applicant')).toBe('Acme Developments Ltd')
    expect(inputValue(result, 'planningApplicationReference')).toBe(
      '24/01234/FUL'
    )
    expect(inputValue(result, 'planningApplicationType')).toBe(
      'Outline planning permission'
    )
    expect(result).toMatch(/<option value="E60000001" selected>/)
  })

  test('AC4/AC5 limits each input to its maximum length', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    const maxlength = (id) =>
      /maxlength="(\d+)"/.exec(
        new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(result)[0]
      )[1]
    expect(maxlength('projectName')).toBe('1000')
    expect(maxlength('surveyCompleters')).toBe('255')
    expect(maxlength('applicant')).toBe('255')
    expect(maxlength('planningApplicationReference')).toBe('50')
    expect(maxlength('planningApplicationType')).toBe('100')
    expect(maxlength('surveyCompletionDate-day')).toBe('2')
    expect(maxlength('surveyCompletionDate-month')).toBe('2')
    expect(maxlength('surveyCompletionDate-year')).toBe('4')
  })

  test('AC1 shows the left navigation with Project details as the current item', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain(
      '<strong class="app-project-navigation__current" aria-current="page">Project details</strong>'
    )
    expect(result).toContain(`href="${summaryUrl}">Summary</a>`)
  })

  test('returns to the page named in returnUrl on Cancel', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `${url}?returnUrl=${encodeURIComponent(areaSummaryUrl)}`,
      auth: authedAuth
    })
    expect(result).toContain(
      `<a class="govuk-link" href="${areaSummaryUrl}">Cancel</a>`
    )
    expect(result).toContain(
      `<input type="hidden" name="returnUrl" value="${areaSummaryUrl}">`
    )
  })

  test.each(['https://evil.example', '//evil.example', 'javascript:alert(1)'])(
    'falls back to the project summary for an off-site returnUrl %s',
    async (returnUrl) => {
      const { result } = await server.inject({
        method: 'GET',
        url: `${url}?returnUrl=${encodeURIComponent(returnUrl)}`,
        auth: authedAuth
      })
      expect(result).toContain(
        `<a class="govuk-link" href="${summaryUrl}">Cancel</a>`
      )
    }
  )

  test('returns 502 rather than an empty dropdown when the lookup fails', async () => {
    vi.mocked(fetchLocalPlanningAuthorities).mockRejectedValueOnce(
      Boom.badGateway('Lookup unavailable')
    )
    const res = await server.inject({ method: 'GET', url, auth: authedAuth })
    expect(res.statusCode).toBe(statusCodes.badGateway)
  })

  test('shows legacy free text without guessing a reference', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: { details: { localPlanningAuthority: 'Historic council' } }
      }
    })
    const { result } = await server.inject({
      method: 'GET',
      url,
      auth: authedAuth
    })
    expect(result).toContain(
      'Previously saved local planning authority: Historic council'
    )
    expect(result).toMatch(/<option value="" selected>/)
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
    vi.mocked(wreck.get).mockRejectedValue(responseError(500))
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

  test('returns 400 when projectId is not a UUID', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/project-details/not-a-uuid',
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('redirects unauthenticated users', async () => {
    const { statusCode } = await server.inject({ method: 'GET', url })
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
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProject
    })
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

  function post(payload) {
    return server.inject({
      method: 'POST',
      url,
      payload: { ...payload, crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })
  }

  test('AC8 PATCHes the name and details together, trimmed', async () => {
    await post({
      ...formPayload,
      projectName: `  ${projectName}  `,
      surveyCompleters: '  Jane Smith '
    })

    expect(wreck.patch).toHaveBeenCalledOnce()
    const [patchUrl, options] = vi.mocked(wreck.patch).mock.calls[0]
    expect(patchUrl).toContain(`/projects/${projectId}/details`)
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.payload)).toEqual(expectedPatch)
  })

  test('AC8 returns to the page the user came from, with no success message', async () => {
    const { statusCode, headers } = await post(formPayload)
    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(areaSummaryUrl)
  })

  test('AC8 returns to the project summary when no page was named', async () => {
    const { headers } = await post({ ...formPayload, returnUrl: '' })
    expect(headers.location).toBe(summaryUrl)
  })

  test('returns to the project summary rather than an off-site returnUrl', async () => {
    const { headers } = await post({
      ...formPayload,
      returnUrl: 'https://evil.example/'
    })
    expect(headers.location).toBe(summaryUrl)
  })

  test('AC8 sends explicit null for fields left blank, so the backend clears them', async () => {
    await post({ projectName })
    const body = JSON.parse(vi.mocked(wreck.patch).mock.calls[0][1].payload)
    expect(body).toEqual({
      name: projectName,
      surveyCompleters: null,
      surveyCompletionDate: null,
      applicant: null,
      localPlanningAuthorityReference: null,
      planningApplicationReference: null,
      planningApplicationType: null
    })
  })

  test('saves without fetching the project or the LPA lookup', async () => {
    vi.mocked(fetchLocalPlanningAuthorities).mockClear()
    const res = await post(formPayload)
    expect(res.statusCode).toBe(statusCodes.redirect)
    expect(wreck.get).not.toHaveBeenCalled()
    expect(fetchLocalPlanningAuthorities).not.toHaveBeenCalled()
  })

  test('AC10 shows every problem at once, in field order, without saving', async () => {
    const res = await post({
      ...formPayload,
      projectName: '   ',
      surveyCompleters: 'a'.repeat(256),
      'surveyCompletionDate-day': '',
      applicant: 'Bad\u0007name',
      planningApplicationReference: 'a'.repeat(51),
      planningApplicationType: 'a'.repeat(101)
    })
    expect(res.statusCode).toBe(statusCodes.ok)
    expect(wreck.patch).not.toHaveBeenCalled()

    const messages = [
      'Enter a project name',
      'Survey completed by must be 255 characters or fewer',
      'Survey date must include a day',
      'Planning permission applicant name must only contain valid characters',
      'Planning application reference must be 50 characters or fewer',
      'Planning application type must be 100 characters or fewer'
    ]
    const summary = res.result.slice(
      res.result.indexOf('govuk-error-summary'),
      res.result.indexOf('<h1')
    )
    const positions = messages.map((message) => summary.indexOf(message))
    expect(positions.every((position) => position > 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(summary).toContain('href="#projectName"')
    expect(summary).toContain('href="#surveyCompletionDate-day"')
    expect(res.result).toMatch(/<title>\s*Error: Project details/)
  })

  test('AC10 keeps every value as entered', async () => {
    const res = await post({
      ...formPayload,
      projectName: '',
      'surveyCompletionDate-day': 'ab'
    })
    expect(inputValue(res.result, 'surveyCompleters')).toBe('Jane Smith')
    expect(inputValue(res.result, 'surveyCompletionDate-day')).toBe('ab')
    expect(inputValue(res.result, 'planningApplicationType')).toBe(
      'Outline planning permission'
    )
    expect(res.result).toMatch(/<option value="E60000001" selected>/)
    expect(res.result).toContain(
      `<input type="hidden" name="returnUrl" value="${areaSummaryUrl}">`
    )
    expect(res.result).toContain(
      '<strong class="app-project-navigation__current" aria-current="page">Project details</strong>'
    )
  })

  test.each([
    [
      { 'surveyCompletionDate-month': '' },
      'Survey date must include a month',
      ['month']
    ],
    [
      { 'surveyCompletionDate-day': '', 'surveyCompletionDate-year': '' },
      'Survey date must include day and year',
      ['day', 'year']
    ],
    [
      { 'surveyCompletionDate-month': 'Ju' },
      'Survey date must only include numbers',
      ['month']
    ],
    [
      { 'surveyCompletionDate-day': '31', 'surveyCompletionDate-month': '02' },
      'Survey date must be a real date',
      ['day', 'month', 'year']
    ],
    [
      { 'surveyCompletionDate-year': '2999' },
      'Survey date must be today or in the past',
      ['day', 'month', 'year']
    ]
  ])(
    'AC10 survey date %j is refused with "%s"',
    async (dateFields, message, parts) => {
      const res = await post({ ...formPayload, ...dateFields })
      expect(wreck.patch).not.toHaveBeenCalled()
      expect(res.result).toContain(message)
      for (const part of ['day', 'month', 'year']) {
        const input = new RegExp(
          `<input[^>]*id="surveyCompletionDate-${part}"[^>]*>`
        ).exec(res.result)[0]
        expect(input.includes('govuk-input--error')).toBe(parts.includes(part))
      }
    }
  )

  test.each(['E60099999', 'not-a-reference'])(
    'rejects unknown or malformed reference %s and retains the rest of the form',
    async (reference) => {
      if (reference === 'E60099999') {
        vi.mocked(wreck.patch).mockRejectedValueOnce(responseError(400))
      }
      const res = await post({
        ...formPayload,
        localPlanningAuthorityReference: reference
      })
      expect(res.statusCode).toBe(statusCodes.ok)
      expect(res.result).toContain(
        'Select a local planning authority from the list'
      )
      expect(res.result).toContain('href="#localPlanningAuthorityReference"')
      expect(inputValue(res.result, 'surveyCompleters')).toBe('Jane Smith')
      expect(wreck.patch).toHaveBeenCalledTimes(
        reference === 'E60099999' ? 1 : 0
      )
    }
  )

  test('returns 404 when backend returns 404', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(responseError(404))
    const { statusCode } = await post(formPayload)
    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns 502 when backend returns a non-2xx response', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(responseError(500))
    const { statusCode } = await post(formPayload)
    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('returns 502 when wreck throws', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(new Error('Network failure'))
    const { statusCode } = await post(formPayload)
    expect(statusCode).toBe(statusCodes.badGateway)
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
      payload: formPayload,
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
