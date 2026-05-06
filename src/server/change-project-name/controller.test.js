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
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProject
    })
  })

  afterEach(() => {
    vi.mocked(wreck.get).mockReset()
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
      expect.stringContaining('Project Name - Biodiversity Net Gain')
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
    vi.mocked(wreck.get).mockRejectedValue(
      Boom.gatewayTimeout('Client request timeout')
    )

    const { statusCode } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.gatewayTimeout)
  })

  test('Should return 502 when backend returns a non-2xx response', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 500 },
      payload: null
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url: changeProjectNameUrl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('Should return 404 when backend returns 404', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { statusCode: 404 }
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
      payload: {}
    })
    crumb = await primeCrumb(server)
  })

  afterEach(() => {
    vi.mocked(wreck.patch).mockReset()
    vi.restoreAllMocks()
  })

  test('Should PATCH the backend with correct payload on valid input', async () => {
    await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Updated Project Name', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(wreck.patch).toHaveBeenCalledOnce()

    const [url, options] = vi.mocked(wreck.patch).mock.calls[0]
    const body = JSON.parse(options.payload)

    expect(url).toContain(`/projects/${projectId}`)
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(body.project).toEqual({ name: 'Updated Project Name' })
  })

  test('Should redirect to project task list on valid input', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Updated Project Name', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/project-task-list/${projectId}`)
  })

  test('Should return 502 when backend returns a non-2xx response', async () => {
    vi.mocked(wreck.patch).mockResolvedValue({
      res: { statusCode: 500 },
      payload: null
    })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Updated Project Name', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('Should show error summary when project name is empty', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: '', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(expect.stringContaining('Enter a project name'))
    expect(result).toEqual(
      expect.stringContaining('Error: Project Name - Biodiversity Net Gain')
    )
    expect(wreck.patch).not.toHaveBeenCalled()
  })

  test('Should show error summary when project name exceeds 1000 characters', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'a'.repeat(1001), crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(
      expect.stringContaining('Project name must be 1000 characters or fewer')
    )
    expect(wreck.patch).not.toHaveBeenCalled()
  })

  test('Should show error summary when project name contains invalid characters', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Invalid\x00Name', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(
      expect.stringContaining('Project name must only contain valid characters')
    )
    expect(wreck.patch).not.toHaveBeenCalled()
  })

  test('Should show red error border on input when validation fails', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: '', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
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
      payload: { projectName: 'My Project\x01', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('value="My Project'))
  })

  test('Should return 400 when project id is not a UUID', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/change-project-name/not-a-uuid',
      payload: { projectName: 'Valid Name', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should show error summary when projectName field is missing from payload', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(expect.stringContaining('Enter a project name'))
    expect(wreck.patch).not.toHaveBeenCalled()
  })

  test('Should show error summary when project name is whitespace only', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: '   ', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(expect.stringContaining('Enter a project name'))
    expect(wreck.patch).not.toHaveBeenCalled()
  })

  test('Should reject POST with 403 when crumb is missing', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: changeProjectNameUrl,
      payload: { projectName: 'Updated Project Name' },
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.forbidden)
    expect(wreck.patch).not.toHaveBeenCalled()
  })
})
