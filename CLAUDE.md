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
