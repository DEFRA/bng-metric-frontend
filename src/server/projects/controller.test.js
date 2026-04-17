import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'

const mockProjects = [
  {
    id: 'aaa-bbb-ccc',
    project: {
      name: 'Greenfield Meadow Restoration',
      site: { name: 'Greenfield Meadow', grid_ref: 'TQ 123 456' },
      units: { habitat: 10.5, hedgerow: 2.3, watercourse: 0.8 }
    },
    userId: 'test-user-001',
    bngProjectVersion: 1,
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 'ddd-eee-fff',
    project: {
      name: 'Oakwood Farm BNG Assessment',
      site: { name: 'Oakwood Farm', grid_ref: 'SP 987 654' },
      units: { habitat: 25.0, hedgerow: 8.1 }
    },
    userId: 'test-user-002',
    bngProjectVersion: 2,
    createdAt: '2024-02-01T00:00:00.000Z'
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

  test('Should render the projects list page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/project-dashboard'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Projects |'))
  })

  test('Should show no projects message', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/project-dashboard'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('No projects started.'))
  })
})

describe('#projectDetailController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the project detail page', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockProjects[0])
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/project-dashboard/aaa-bbb-ccc'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Greenfield Meadow Restoration')
    )
    expect(result).toEqual(expect.stringContaining('Greenfield Meadow'))
    expect(result).toEqual(expect.stringContaining('TQ 123 456'))
    expect(result).toEqual(expect.stringContaining('10.5'))
    expect(result).toEqual(expect.stringContaining('test-user-001'))
    expect(result).toEqual(expect.stringContaining('Back to projects'))
  })
})
