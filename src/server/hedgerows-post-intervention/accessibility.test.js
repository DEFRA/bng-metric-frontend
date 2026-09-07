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
      units: { hedgerowsTotal: 1.52 },
      hedgerows: [{}]
    },
    postIntervention: {
      hedgerows: [
        { retentionCategory: 'Retained' },
        { retentionCategory: 'Enhanced' },
        { retentionCategory: 'Created' }
      ],
      units: {
        hedgerowsTotal: 1.64,
        hedgerowsNetUnitChange: 0.12,
        hedgerowsNetUnitChangePercentage: 7.72
      }
    }
  }
}

describe('Hedgerows post-intervention page accessibility checks', () => {
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
      requestUrl: `/projects/${PROJECT_ID}/hedgerows-post-intervention`,
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
          baseline: { units: { hedgerowsTotal: 0 }, hedgerows: [{}] },
          postIntervention: {
            hedgerows: [{ retentionCategory: 'Created' }],
            units: { hedgerowsTotal: 1 }
          }
        }
      }
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/hedgerows-post-intervention`,
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
