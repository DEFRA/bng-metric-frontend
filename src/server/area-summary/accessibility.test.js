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
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const projectWithPostIntervention = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      units: {
        habitatsTotal: 1.23456789012345,
        treesTotal: 0.285
      }
    },
    postIntervention: {
      units: {
        habitatsTotal: 1.64,
        treesTotal: 0,
        habitatsNetUnitChange: 0.12,
        habitatsNetUnitChangePercentage: 7.72
      }
    }
  }
}

const baselineOnlyProject = {
  project: {
    name: 'Baseline only project',
    baseline: {
      units: {
        habitatsTotal: 1.23456789012345,
        treesTotal: 0.285
      }
    }
  }
}

describe('Area summary page accessibility checks', () => {
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

  test.each([
    ['baseline and post-intervention data', projectWithPostIntervention],
    ['baseline-only data', baselineOnlyProject]
  ])('has no accessibility violations with %s', async (_, payload) => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/area-summary`,
      server,
      auth
    })

    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
