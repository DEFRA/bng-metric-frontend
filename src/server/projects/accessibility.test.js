// @vitest-environment happy-dom
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn()
  }
}))

const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
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

describe('Projects list page accessibility checks', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.mocked(wreck.get).mockReset()
  })

  it('should have no HTML accessibility issues with a populated projects table', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockProjects
    })

    const { document } = await loadPage({
      requestUrl: '/manage-projects',
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
