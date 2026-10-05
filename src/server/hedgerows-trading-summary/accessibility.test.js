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

describe('Hedgerows trading placeholder accessibility', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test.each(['baseline', 'postIntervention'])(
    'has no accessibility violations with hedgerows only in %s',
    async (phase) => {
      const project = {
        name: 'Test project',
        baseline: {},
        postIntervention: {}
      }
      project[phase].hedgerows = [{}]
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: 200 },
        payload: { project }
      })

      const { document } = await loadPage({
        requestUrl: `/projects/${PROJECT_ID}/hedgerows-trading-summary`,
        server,
        auth
      })

      assertLayoutLandmarks(document)
      await runAxeChecks(document.documentElement)
    }
  )
})
