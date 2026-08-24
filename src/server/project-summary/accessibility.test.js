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

function projectWithLinearHabitats(hasLinearHabitats) {
  return {
    project: {
      name: 'Riverbank restoration',
      baseline: {
        habitats: [{}],
        hedgerows: hasLinearHabitats ? [{}] : [],
        watercourses: hasLinearHabitats ? [{}] : [],
        units: {
          habitatsTotal: 8,
          treesTotal: 2,
          hedgerowsTotal: hasLinearHabitats ? 4 : 0,
          watercoursesTotal: hasLinearHabitats ? 10 : 0
        }
      }
    }
  }
}

function projectWithPostInterventionOnlyLinearHabitats() {
  return {
    project: {
      name: 'Created linear habitats',
      baseline: {
        habitats: [{}],
        hedgerows: [],
        watercourses: [],
        units: {
          habitatsTotal: 8,
          treesTotal: 2,
          hedgerowsTotal: 0,
          watercoursesTotal: 0
        }
      },
      postIntervention: {
        habitats: [{}],
        hedgerows: [{ retentionCategory: 'Created' }],
        watercourses: [{ retentionCategory: 'Created' }],
        units: {
          habitatsTotal: 9,
          treesTotal: 2,
          habitatsNetUnitChange: 1,
          habitatsNetUnitChangePercentage: 10,
          hedgerowsTotal: 1.98,
          hedgerowsNetUnitChange: 1.98,
          hedgerowsNetUnitChangePercentage: null,
          watercoursesTotal: 2.34,
          watercoursesNetUnitChange: 2.34,
          watercoursesNetUnitChangePercentage: null
        }
      }
    }
  }
}

describe('Project summary page accessibility checks', () => {
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
    ['all habitat summaries', () => projectWithLinearHabitats(true)],
    ['only the area habitat summary', () => projectWithLinearHabitats(false)],
    [
      'post-intervention-only linear habitats',
      projectWithPostInterventionOnlyLinearHabitats
    ]
  ])('has no accessibility violations with %s', async (_, projectFactory) => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: projectFactory()
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/project-summary`,
      server,
      auth
    })

    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
