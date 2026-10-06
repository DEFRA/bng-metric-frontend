// @vitest-environment happy-dom
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'
import { WORKED_EXAMPLE_TRADING_RULES } from './worked-example.fixture.js'

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

describe('Hedgerows trading summary page accessibility checks', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('has no accessibility violations with the worked example figures', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        tradingRuleStatuses: {
          hedgerows: {
            medium: 'Met',
            low: 'Not met',
            veryLow: 'Not met',
            overall: 'Not met'
          }
        },
        project: {
          name: 'Worked example',
          baseline: { hedgerows: [{ id: 'baseline-hedge' }] },
          postIntervention: {
            hedgerows: [{ id: 'created-hedge' }],
            tradingRules: { hedgerows: WORKED_EXAMPLE_TRADING_RULES }
          }
        }
      }
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/hedgerows-trading-summary`,
      server,
      auth
    })

    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  test.each(['baseline', 'postIntervention'])(
    'has no accessibility violations without saved figures, hedgerows only in %s',
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
