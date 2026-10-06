import Boom from '@hapi/boom'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
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

// The list endpoint returns a projection, not the stored project document:
// name and timestamps. Nothing here carries a baseline or post-intervention body.
const mockProjects = [
  {
    id: '0d7c6f7c-5f9e-4e7e-8f77-9d99d30a8d77',
    projectId: '0d7c6f7c-5f9e-4e7e-8f77-9d99d30a8d77',
    project: { name: 'Greenfield Meadow Restoration' },
    has_baseline: false,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-03-20T00:00:00.000Z'
  },
  {
    id: '16b0bb16-11f9-44f4-9b19-51fb2f0a1c6f',
    projectId: '16b0bb16-11f9-44f4-9b19-51fb2f0a1c6f',
    project: { name: 'Oakwood Farm BNG Assessment' },
    has_baseline: false,
    createdAt: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-04-10T00:00:00.000Z'
  }
]

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
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProjects
    })
  })

  afterEach(() => {
    vi.mocked(wreck.get).mockReset()
    vi.restoreAllMocks()
  })

  test('Should render the projects list page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Projects -'))
  })

  test('Should fetch projects for the current user', async () => {
    await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(wreck.get).toHaveBeenCalledWith(
      expect.stringContaining(`/users/${authCredentials.sub}/projects`),
      expect.objectContaining({ headers: expect.any(Object) })
    )
  })

  test('Should render a table with project name, last modified, and date created', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
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

  test('Should render each project name as a link to its project summary', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining(
        `href="/projects/${mockProjects[0].id}/project-summary"`
      )
    )
    expect(result).toEqual(
      expect.stringContaining(
        `href="/projects/${mockProjects[1].id}/project-summary"`
      )
    )
    expect(result).toEqual(
      expect.stringContaining(
        `href="/projects/${mockProjects[0].id}/project-summary">Greenfield Meadow Restoration</a>`
      )
    )
    expect(result).toEqual(
      expect.stringContaining(
        `href="/projects/${mockProjects[1].id}/project-summary">Oakwood Farm BNG Assessment</a>`
      )
    )
  })

  test('Should link a project flagged has_baseline to its project summary', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: [{ ...mockProjects[0], has_baseline: true }]
    })

    const { result } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(result).toContain(
      `href="/projects/${mockProjects[0].id}/project-summary"`
    )
  })

  test('Should render the list without any project document body', async () => {
    // The dashboard only needs names and timestamps from the list endpoint.
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Greenfield Meadow Restoration')
    )
    expect(result).toEqual(expect.stringContaining('15 January 2024'))
  })

  test('Should link a legacy-shaped project to its summary', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: [
        {
          id: mockProjects[0].id,
          project: { name: 'Legacy Shape', baseline: { units: {} } },
          createdAt: mockProjects[0].createdAt,
          updatedAt: mockProjects[0].updatedAt
        }
      ]
    })

    const { result } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(result).toContain(
      `href="/projects/${mockProjects[0].id}/project-summary"`
    )
  })

  test('Should link a project with no baseline to its project summary', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(result).toContain(
      `href="/projects/${mockProjects[0].id}/project-summary"`
    )
  })

  test('Should redirect to project-name when backend returns empty array', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: []
    })

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/project-name')
  })

  test('Should return 502 when backend returns a non-2xx response', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 503 },
      payload: null
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('Should return 500 when wreck throws an unexpected error', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Network failure'))

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
  })

  test('Should return 504 when backend request times out', async () => {
    vi.mocked(wreck.get).mockRejectedValue(
      Boom.gatewayTimeout('Client request timeout')
    )

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/manage-projects',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.gatewayTimeout)
  })
})

describe('removed project task list URL', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('returns 404', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/add-project-details/${mockProjects[0].id}`,
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
