import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'

const authCredentials = {
  sub: 'test-user-123',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:1']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

const projectId = '0d7c6f7c-5f9e-4e7e-8f77-9d99d30a8d77'

const mockProject = {
  project: {
    id: projectId,
    name: 'Greenfield Meadow Restoration'
  }
}

const changeProjectNameUrl = `/change-project-name/${projectId}`

describe('#changeProjectNameController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockProject)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should render the change project name page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Change Project Name - Biodiversity Net Gain')
    )
  })

  test('Should pre-populate the input with the current project name', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('value="Greenfield Meadow Restoration"')
    )
  })

  test('Should render a back link to the project task list', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining(`href="/project-task-list/${projectId}"`)
    )
    expect(result).toEqual(expect.stringContaining('govuk-back-link'))
  })

  test('Should render an input with maxlength of 1000', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('maxlength="1000"'))
    expect(result).toEqual(expect.stringContaining('type="text"'))
  })

  test('Should return 400 when project id is not a UUID', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/change-project-name/not-a-uuid',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should redirect to login when unauthenticated', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })

  test('Should return 504 when backend request times out', async () => {
    const abortError = new DOMException(
      'The operation was aborted.',
      'AbortError'
    )
    vi.spyOn(global, 'fetch').mockRejectedValue(abortError)

    const { statusCode } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.gatewayTimeout)
  })

  test('Should return 404 when backend returns 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ statusCode: 404 })
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})

describe('#changeProjectNamePostController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should PATCH the backend with correct payload on valid input', async () => {
    await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Updated Project Name' },
      auth: authedAuth
    })

    expect(fetch).toHaveBeenCalledOnce()

    const [url, options] = fetch.mock.calls[0]
    const body = JSON.parse(options.body)

    expect(url).toContain(`/projects/${projectId}`)
    expect(options.method).toBe('PATCH')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(body.project).toEqual({ name: 'Updated Project Name' })
  })

  test('Should redirect to project task list on valid input', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Updated Project Name' },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/project-task-list/${projectId}`)
  })

  test('Should return 502 when backend returns a non-2xx response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Updated Project Name' },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('Should show error summary when project name is empty', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: '' },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(expect.stringContaining('Enter a project name'))
    expect(result).toEqual(
      expect.stringContaining(
        'Error: Change Project Name - Biodiversity Net Gain'
      )
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should show error summary when project name exceeds 1000 characters', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'a'.repeat(1001) },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(
      expect.stringContaining('Project name must be 1000 characters or fewer')
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should show error summary when project name contains invalid characters', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Invalid\x00Name' },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(
      expect.stringContaining('Project name must only contain valid characters')
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should show red error border on input when validation fails', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: '' },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('govuk-form-group--error'))
    expect(result).toEqual(expect.stringContaining('govuk-input--error'))
  })

  test('Should repopulate the input with submitted value on error', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'My Project\x01' },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('value="My Project'))
  })

  test('Should return 400 when project id is not a UUID', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/change-project-name/not-a-uuid',
      payload: { projectName: 'Valid Name' },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
