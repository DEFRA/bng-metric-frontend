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
      habitats: [{}]
    },
    postIntervention: {
      habitats: [
        { retentionCategory: 'Retained', broadType: 'Grassland' },
        { retentionCategory: 'Enhanced', broadType: 'Grassland' }
      ],
      trees: [{ retentionCategory: 'Created', broadType: 'Individual trees' }],
      habitatSizes: {
        site: { totalSquareMetres: 30000 },
        areaHabitats: { totalSquareMetres: 30163 }
      },
      units: {
        habitatsTotal: 25,
        treesTotal: 0.2,
        habitatsNetUnitChange: 0.68,
        habitatsNetUnitChangePercentage: 2.8
      }
    }
  }
}

describe('Area habitats post-intervention page accessibility checks', () => {
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

  it('should have no HTML accessibility issues with all tabs visible', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: populatedProject
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/area-post-intervention`,
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  it('should have no HTML accessibility issues when only one tab is visible', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Created only',
          baseline: { units: { habitatsTotal: 0 }, habitats: [{}] },
          postIntervention: {
            trees: [
              { retentionCategory: 'Created', broadType: 'Individual trees' }
            ],
            units: { treesTotal: 1 }
          }
        }
      }
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/area-post-intervention`,
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
