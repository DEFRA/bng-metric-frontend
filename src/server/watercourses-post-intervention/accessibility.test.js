// @vitest-environment happy-dom
import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn() }
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_PATH = `/projects/${PROJECT_ID}/watercourses-post-intervention`

const auth = {
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
      units: { watercoursesTotal: 1.52 },
      watercourses: [{}]
    },
    postIntervention: {
      watercourses: [
        { retentionCategory: 'Retained' },
        { retentionCategory: 'Enhanced' },
        { retentionCategory: 'Created' }
      ],
      units: {
        watercoursesTotal: 1.64,
        watercoursesNetUnitChange: 0.12,
        watercoursesNetUnitChangePercentage: 7.72
      }
    }
  }
}

describe('Watercourses post-intervention page accessibility checks', () => {
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
      res: { statusCode: statusCodes.ok },
      payload: populatedProject
    })

    const { document } = await loadPage({
      requestUrl: PAGE_PATH,
      server,
      auth
    })

    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  it('should have no HTML accessibility issues when only one tab is visible', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Created only',
          baseline: {
            units: { watercoursesTotal: 0 },
            watercourses: [{}]
          },
          postIntervention: {
            watercourses: [{ retentionCategory: 'Created' }],
            units: { watercoursesTotal: 1 }
          }
        }
      }
    })

    const { document } = await loadPage({
      requestUrl: PAGE_PATH,
      server,
      auth
    })

    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
