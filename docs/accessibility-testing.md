# Accessibility testing

Pages are checked with [`axe-core`](https://github.com/dequelabs/axe-core) (via
[`vitest-axe`](https://github.com/chaance/vitest-axe)), run against the real
markup a route renders. This catches structural regressions — missing
landmarks, bad heading order, unlabelled controls — that plain
`expect.stringContaining(...)` assertions on the HTML don't.

Three shared helpers in `src/server/test-helpers/` do the work:

- `load-page.js` — `loadPage({ requestUrl, server, auth, headers })` injects a
  GET request into a real, initialised Hapi server and parses the response
  into a DOM `document`.
- `axe-helper.js` — `runAxeChecks(container, options)` runs `axe-core` against
  a DOM node (typically `document.documentElement`) and asserts there are no
  WCAG 2.2 A/AA violations.
- `assert-landmarks.js` — `assertLayoutLandmarks(document)` asserts the shared
  `page.njk` header, service navigation, phase banner and footer landmarks
  are present. `axe-core` only checks markup that's there — a landmark
  missing entirely (e.g. a broken block override in `page.njk`) produces no
  violation, so call this alongside `runAxeChecks`, not instead of it.

## Adding an accessibility test for a page

Copy [`src/server/test-helpers/accessibility-test.template.js`](../src/server/test-helpers/accessibility-test.template.js)
into the page's route folder as `accessibility.test.js` (a sibling of that
page's `controller.test.js`) and work through the `TODO`s in it. It's not
picked up by vitest itself — the filename deliberately doesn't end in
`.test.js` — so it's safe to leave in place as a live template rather than
copy it out of the repo.

`src/server/projects/accessibility.test.js` is the worked example the
template was extracted from, if you want to see a filled-in version.

Add one `it` per meaningfully different render branch (populated, empty,
error, validation-error states, etc.), mocking the backend the same way the
page's existing `controller.test.js` does — usually
`vi.mock('../common/helpers/wreck-client.js', ...)`.

The `// @vitest-environment happy-dom` pragma is required — it's what makes
`DOMParser` (used by `load-page.js`) available as a global, matching the
convention already used by `src/client/javascripts/*.test.js`.

## Rolling this out to other pages

There's no blanket page-by-page requirement yet — add an
`accessibility.test.js` alongside a page's `controller.test.js` when you touch
that page, or when a ticket specifically asks for it. The projects list page
(`src/server/projects/accessibility.test.js`) is the only page currently
covered; the rest of the app's ~18 other page routes don't have one yet.

## Known accepted finding: content outside `<main>`

The GOV.UK Design System's own page template renders the phase banner and
breadcrumbs in `beforeContent`, which sits outside `<main>` by design — see
[the page template](https://design-system.service.gov.uk/styles/page-template/).
`page.njk` wraps that block in `<div role="region" aria-label="Page
information">` so it's still contained in a landmark for the `region` axe
rule, without deviating from the framework's recommended structure.
