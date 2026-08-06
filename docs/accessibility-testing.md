# Accessibility testing

Pages are checked with [`axe-core`](https://github.com/dequelabs/axe-core) (via
[`vitest-axe`](https://github.com/chaance/vitest-axe)), run against the real
markup a route renders. This catches structural regressions — missing
landmarks, bad heading order, unlabelled controls — that plain
`expect.stringContaining(...)` assertions on the HTML don't.

Two shared helpers in `src/server/test-helpers/` do the work:

- `load-page.js` — `loadPage({ requestUrl, server, auth, headers })` injects a
  GET request into a real, initialised Hapi server and parses the response
  into a DOM `document`.
- `axe-helper.js` — `runAxeChecks(container, options)` runs `axe-core` against
  a DOM node (typically `document.documentElement`) and asserts there are no
  WCAG 2.2 A/AA violations.

## Adding an accessibility test for a page

Follow `src/server/projects/accessibility.test.js` as the worked example. The
shape is:

    // @vitest-environment happy-dom
    import { createServer } from '../server.js'
    import { loadPage } from '../test-helpers/load-page.js'
    import { runAxeChecks } from '../test-helpers/axe-helper.js'

    describe('<Page name> accessibility checks', () => {
      let server

      beforeAll(async () => {
        server = await createServer()
        await server.initialize()
      })

      afterAll(async () => {
        await server.stop({ timeout: 0 })
      })

      it('should have no HTML accessibility issues', async () => {
        const { document } = await loadPage({
          requestUrl: '/my-page',
          server,
          auth: authedAuth // if the route requires auth
        })
        await runAxeChecks(document.documentElement)
      })
    })

Mock backend calls the same way the page's existing `controller.test.js` does
(usually `vi.mock('../common/helpers/wreck-client.js', ...)`) so each
significant render branch (empty state, error state, populated state) can get
its own accessibility check.

The `// @vitest-environment happy-dom` pragma is required — it's what makes
`DOMParser` (used by `load-page.js`) available as a global, matching the
convention already used by `src/client/javascripts/*.test.js`.

## Rolling this out to other pages

There's no blanket page-by-page requirement yet — add an
`accessibility.test.js` alongside a page's `controller.test.js` when you touch
that page, or when a ticket specifically asks for it (this pattern was
introduced for BMD-893/BMD-892 to cover the projects list page first).

## Known accepted finding: content outside `<main>`

The GOV.UK Design System's own page template renders the phase banner and
breadcrumbs in `beforeContent`, which sits outside `<main>` by design — see
[the page template](https://design-system.service.gov.uk/styles/page-template/).
`page.njk` wraps that block in `<div role="region" aria-label="Page
information">` so it's still contained in a landmark for the `region` axe
rule, without deviating from the framework's recommended structure.
