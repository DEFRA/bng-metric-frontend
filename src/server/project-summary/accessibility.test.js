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
  const linearHabitats = hasLinearHabitats ? [{}] : []

  return {
    project: {
      name: 'Riverbank restoration',
      baseline: {
        habitats: [{}],
        hedgerows: linearHabitats,
        watercourses: linearHabitats,
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
    ['all habitat summaries', true],
    ['only the area habitat summary', false]
  ])(
    'has no accessibility violations with %s',
    async (_, hasLinearHabitats) => {
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: 200 },
        payload: projectWithLinearHabitats(hasLinearHabitats)
      })

      const { document } = await loadPage({
        requestUrl: `/projects/${PROJECT_ID}/project-summary`,
        server,
        auth
      })

      assertLayoutLandmarks(document)
      await runAxeChecks(document.documentElement)
    }
  )
})
