# bng-metric-frontend

Hapi + Nunjucks + GOV.UK Frontend, port 3000. Sibling of `bng-metric-backend`
(port 3001). Workspace conventions live in [`../CLAUDE.md`](../CLAUDE.md).

## CSRF and forms

CSRF is enforced globally via `@hapi/crumb`. POST/PUT/PATCH/DELETE requests
without a valid token are rejected with 403 before the handler runs. There is
nothing to register per route.

- **Forms**: always use `{% call appForm({ action: "..." }) %}`, never bare
  `<form method="post">`. The macro injects the hidden `crumb` input.
- **`with context`**: any new layout that imports `appForm` itself must use
  `{% from "form/macro.njk" import appForm with context %}` — without it the
  hidden token renders empty and submissions silently 403.
- **PUT/PATCH/DELETE**: unreachable from a plain HTML form. Call them via
  `fetch`, reading the token from `<meta name="csrf-token">`.
- **Tests**: prime the token with `primeCrumb` from
  `src/server/common/test-helpers/csrf.js`. Each new POST route should
  include one negative test asserting 403 when the crumb is omitted.

Full reference, exceptions, and PR review checklist: [`docs/csrf.md`](docs/csrf.md).

## Accessibility testing

Pages are checked with `axe-core` (via `vitest-axe`) against real rendered
markup, using shared helpers in `src/server/test-helpers/`
(`load-page.js`, `axe-helper.js`). See `src/server/projects/accessibility.test.js`
for the worked example and [`docs/accessibility-testing.md`](docs/accessibility-testing.md)
for the pattern to follow when adding one for another page.

## Code style

- **Always attempt to respect default SonarCloud conventions where possible** — write to them in the first draft rather than waiting for the scan to flag them. Code is scanned by SonarCloud (project key in `sonar-project.properties`); after pushing, run `/check-sonar-pr` for PR-scoped issues. Commonly flagged: brace every single-line `if`/`for` body (S121), extract magic numbers to named constants (S109), keep nesting ≤ 3 levels (S134), keep cognitive complexity per function low (S3776), prefer `replaceAll`/template literals over `replace`/concat, and remove dead/commented-out code (S125).
