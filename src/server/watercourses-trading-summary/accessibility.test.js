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

const workedExample = {
  tradingRuleStatuses: {
    watercourses: { medium: 'Not met', low: 'Not met', overall: 'Not met' }
  },
  project: {
    name: 'Worked example',
    baseline: { watercourses: [{ id: 'baseline-ditch' }] },
    postIntervention: {
      watercourses: [{ id: 'created-ditch' }],
      tradingRules: { watercourses: WORKED_EXAMPLE_TRADING_RULES }
    }
  }
}

const withoutFigures = {
  tradingRuleStatuses: {
    watercourses: { medium: null, low: null, overall: null }
  },
  project: {
    name: 'Uploaded before the figures were calculated',
    baseline: { watercourses: [{ id: 'baseline-ditch' }] },
    postIntervention: { watercourses: [{ id: 'created-ditch' }] }
  }
}

describe('Watercourses trading summary page accessibility checks', () => {
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
    ['the worked example figures', workedExample],
    ['no saved trading-rules figures', withoutFigures]
  ])('has no accessibility violations with %s', async (_, payload) => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/watercourses-trading-summary`,
      server,
      auth
    })

    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
