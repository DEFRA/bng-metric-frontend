// @vitest-environment happy-dom
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn() }
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const populatedProject = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      units: { habitatsTotal: 24, treesTotal: 0.2 },
      habitats: [
        {
          featureId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          ref: 'P-1',
          type: 'Lowland meadows',
          broadType: 'Grassland',
          condition: 'Good',
          conditionScore: 3,
          distinctiveness: 'V.High',
          distinctivenessScore: 8,
          units: 24,
          sizeSquareMetres: 10000
        }
      ],
      trees: [
        {
          featureId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          ref: 'T-1',
          type: 'Urban tree',
          broadType: 'Individual trees',
          condition: 'Good',
          conditionScore: 3,
          distinctiveness: 'Medium',
          distinctivenessScore: 4,
          units: 0.2,
          sizeSquareMetres: 163
        }
      ]
    }
  }
}

describe('Area baseline page accessibility checks', () => {
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

  it('should have no HTML accessibility issues with a populated grid', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: populatedProject
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/area-baseline`,
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  it('should have no HTML accessibility issues when there are no habitat rows', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Empty baseline',
          baseline: { units: { habitatsTotal: 0, treesTotal: 0 } }
        }
      }
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/area-baseline`,
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
