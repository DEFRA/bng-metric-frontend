import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'

const authCredentials = {
  sub: 'test-user',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:1']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

const mockProjects = [
  {
    id: '0d7c6f7c-5f9e-4e7e-8f77-9d99d30a8d77',
    project: {
      name: 'Greenfield Meadow Restoration',
      site: { name: 'Greenfield Meadow', grid_ref: 'TQ 123 456' },
      units: { habitat: 10.5, hedgerow: 2.3, watercourse: 0.8 }
    },
    userId: 'test-user-003',
    bngProjectVersion: 1,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-03-20T00:00:00.000Z'
  },
  {
    id: '16b0bb16-11f9-44f4-9b19-51fb2f0a1c6f',
    project: {
      name: 'Oakwood Farm BNG Assessment',
      site: { name: 'Oakwood Farm', grid_ref: 'SP 987 654' },
      units: { habitat: 25.0, hedgerow: 8.1 }
    },
    userId: 'test-user-003',
    bngProjectVersion: 2,
    createdAt: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-04-10T00:00:00.000Z'
  }
]

const projectTaskListurl = `/project-task-list/${mockProjects[0].id}`

describe('#projectsListController', () => {
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
      ok: true,
      json: () => Promise.resolve(mockProjects)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should render the projects list page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/project-dashboard',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Projects -'))
  })

  test('Should fetch projects for the current user', async () => {
    await server.inject({
      method: 'GET',
      url: '/project-dashboard',
      auth: authedAuth
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/users/${authCredentials.sub}/projects`),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  test('Should render a table with project name, last modified, and date created', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/project-dashboard',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('govuk-table'))
    expect(result).toEqual(expect.stringContaining('Project name'))
    expect(result).toEqual(expect.stringContaining('Last modified'))
    expect(result).toEqual(expect.stringContaining('Date created'))
    expect(result).toEqual(
      expect.stringContaining('Greenfield Meadow Restoration')
    )
    expect(result).toEqual(
      expect.stringContaining('Oakwood Farm BNG Assessment')
    )
    expect(result).toEqual(expect.stringContaining('15 January 2024'))
    expect(result).toEqual(expect.stringContaining('20 March 2024 at 12:00am'))
  })

  test('Should render each project name as a link to its task list', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/project-dashboard',
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining(`href="/project-task-list/${mockProjects[0].id}"`)
    )
    expect(result).toEqual(
      expect.stringContaining(`href="/project-task-list/${mockProjects[1].id}"`)
    )
    expect(result).toEqual(
      expect.stringContaining(
        `href="/project-task-list/${mockProjects[0].id}">Greenfield Meadow Restoration</a>`
      )
    )
    expect(result).toEqual(
      expect.stringContaining(
        `href="/project-task-list/${mockProjects[1].id}">Oakwood Farm BNG Assessment</a>`
      )
    )
  })

  test('Should show no projects message when backend returns empty array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/project-dashboard',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('No projects started.'))
  })

  test('Should return 502 when backend returns a non-2xx response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/project-dashboard',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('Should return 500 when fetch throws an unexpected error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'))

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/project-dashboard',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
  })

  test('Should return 504 when backend request times out', async () => {
    vi.useFakeTimers()

    vi.spyOn(global, 'fetch').mockImplementation((_url, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })

    const injectPromise = server.inject({
      method: 'GET',
      url: '/project-dashboard',
      auth: authedAuth
    })

    await vi.advanceTimersByTimeAsync(5000)

    const { statusCode } = await injectPromise

    vi.useRealTimers()

    expect(statusCode).toBe(statusCodes.gatewayTimeout)
  })
})

describe('#projectTaskListController', () => {
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
      json: () => Promise.resolve(mockProjects[0])
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should render the page with correct title', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: projectTaskListurl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Project Task List'))
  })

  test('Should show the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: projectTaskListurl,
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('data-testid="app-heading-title"')
    )
  })

  test('Should show the page paragraph content', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: projectTaskListurl,
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('data-testid="project-task-list-information"')
    )
  })

  test('Should show the page content list', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: projectTaskListurl,
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('data-testid="project-task-list-content-list"')
    )
  })

  test('Should show the page task list', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: projectTaskListurl,
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('data-testid="project-task-list-component"')
    )
  })

  test('Should redirect to login when unauthenticated', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/project-task-list/${mockProjects[0].id}`
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })

  test('Should return bad request when project id is not a UUID', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/project-task-list/aaa-bbb-ccc',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should return 504 when backend request times out', async () => {
    vi.useFakeTimers()

    vi.spyOn(global, 'fetch').mockImplementation((_url, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })

    const injectPromise = server.inject({
      method: 'GET',
      url: projectTaskListurl,
      auth: authedAuth
    })

    await vi.advanceTimersByTimeAsync(5000)

    const { statusCode } = await injectPromise

    vi.useRealTimers()

    expect(statusCode).toBe(statusCodes.gatewayTimeout)
  })

  test('Should return 500 when fetch throws an unexpected error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'))

    const { statusCode } = await server.inject({
      method: 'GET',
      url: projectTaskListurl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
  })

  test('Should render error state when backend returns 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ statusCode: 404 })
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: projectTaskListurl,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Project not found'))
    expect(result).not.toEqual(
      expect.stringContaining('data-testid="project-task-list-information"')
    )
    expect(result).not.toEqual(
      expect.stringContaining('data-testid="project-task-list-component"')
    )
  })
})
