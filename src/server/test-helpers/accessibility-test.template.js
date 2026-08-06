// TEMPLATE — not run by vitest (it doesn't match the `*.test.js` glob).
//
// To add accessibility coverage for a page:
//   1. Copy this file into the page's route folder as `accessibility.test.js`
//      (a sibling of that page's `controller.test.js`).
//   2. Work through every `TODO` below.
//   3. Add one `it` per meaningfully different render branch (populated,
//      empty, error, validation-error states, etc.) — not just the happy path.
//
// See docs/accessibility-testing.md for the full pattern.

// @vitest-environment happy-dom
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js' // TODO: remove if this page doesn't call the backend directly
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'

// TODO: remove this mock if the page doesn't call the backend directly
vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn() }
}))

// TODO: remove if the route doesn't require an authenticated session
const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

// TODO: rename to the real page name, e.g. "Project details page"
describe('TODO page name accessibility checks', () => {
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

  it('should have no HTML accessibility issues', async () => {
    // TODO: shape this like the real backend response for this page
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {}
    })

    const { document } = await loadPage({
      requestUrl: '/TODO-real-route',
      server,
      auth: authedAuth // TODO: remove if the route doesn't require auth
    })
    await runAxeChecks(document.documentElement)
  })
})
