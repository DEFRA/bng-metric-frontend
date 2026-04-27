# CSRF protection

All state-changing requests (POST, PUT, PATCH, DELETE) to this app are
protected by [`@hapi/crumb`](https://github.com/hapijs/crumb). Protection is
global — every route is covered automatically and no per-route registration is
needed.

Plugin wiring lives in `src/server/common/helpers/csrf.js`. A crumb cookie is
issued on the first response to any browser and must be echoed back in the
body of subsequent unsafe requests. Requests whose payload crumb does not
match the cookie are rejected with 403 before the handler runs.

## Adding a new form

Forms are rendered through the `appForm` macro, which emits the `<form>`
element together with the hidden `crumb` input:

    {% call appForm({ action: "/my-endpoint" }) %}
      {# form fields #}
      {{ govukButton({ text: "Continue" }) }}
    {% endcall %}

Supported options: `action` (required), `enctype` (e.g.
`"multipart/form-data"`), `id`, `classes`, `attributes`, `novalidate`
(default true).

`appForm` is imported globally in `layouts/page.njk` with `with context` —
that import form is **mandatory** so the macro can read the request-scoped
`crumb` value. Any new layout that imports the macro independently must
copy the clause verbatim:

    {% from "form/macro.njk" import appForm with context %}

Without `with context`, Nunjucks isolates the macro from its caller's scope
and the hidden input renders empty. The form then looks fine on the page
but every submission fails with 403.

## Adding a new POST/PUT/PATCH/DELETE route

Nothing additional is required. Crumb validates the request before the route
handler is invoked. If the token is missing or mismatched, a 403 response is
returned before any handler code executes.

### POST is the only method reachable from a plain HTML form

The `appForm` macro emits `method="post"` because that is the only unsafe
method an HTML form can send. The HTML specification accepts only `get`,
`post`, and `dialog` as values of the `<form method="…">` attribute; any
other value (including `patch`, `put`, `delete`) is silently coerced to the
default, GET. A form authored as `<form method="patch" action="/x">` is
therefore submitted by the browser as `GET /x`.

Hapi resolves routes by `(method, path)` exactly and does not fall through
on a method mismatch, so a route registered only as PATCH/PUT/DELETE is
unreachable from any HTML form — the request is answered with 404 before
crumb is consulted. Routes restricted to those methods must be reached from
client-side JavaScript via `fetch`, following the pattern in the next
section. A PATCH-only route should therefore be defined alongside the JS
that drives it.

If a single endpoint genuinely needs to serve both a server-rendered form
and an API client, the route can be registered for both methods sharing one
handler, e.g.:

    server.route([
      { method: 'POST',  path: '/projects/{id}', ...handler },
      { method: 'PATCH', path: '/projects/{id}', ...handler }
    ])

Method-override patterns (a hidden `_method` field rewritten by an
`onPreHandler` extension) are not used in this app and should not be added
without a wider discussion.

## Calling endpoints from client-side JavaScript

The current token is exposed in the `<meta name="csrf-token">` tag rendered
into every page. Fetch-based clients read it and include it as `crumb` in the
request body:

    const token = document.querySelector('meta[name="csrf-token"]').content
    await fetch('/api/thing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, crumb: token })
    })

The `X-CSRF-Token` header is **not** honoured — the app runs in
`restful: false` mode and the token must be in the body.

## Disabling crumb on a route

Crumb should only be disabled on routes that are genuinely not
browser-submitted:

1. **Incoming webhooks from a trusted external system.** The route declares
   `options: { plugins: { crumb: false } }` and authenticates the caller
   some other way — signature verification, mTLS, or a shared secret. Crumb
   must never be disabled without a replacement integrity check.
2. **Forms that POST to a different origin** (e.g. the CDP uploader used by
   `upload-baseline-file`). The form bypasses `appForm` because the request
   never reaches this app, so a crumb would be dead weight. A one-line
   comment in the template is expected, explaining why the macro is not
   used.

Crumb must not be disabled as a way to make a failing test pass. The
correct fix is to prime a crumb in the test (see below).

## Writing tests for POST endpoints

The `primeCrumb` helper performs a safe GET to pick up the cookie-bound
token and returns the pieces needed to satisfy CSRF validation:

    import { primeCrumb } from '../common/test-helpers/csrf.js'

    let crumb
    beforeEach(async () => {
      crumb = await primeCrumb(server)
    })

    test('submits the form', async () => {
      await server.inject({
        method: 'POST',
        url: '/my-endpoint',
        payload: { field: 'value', crumb: crumb.token },
        headers: { cookie: crumb.cookie },
        auth: authedAuth
      })
    })

A POST test that omits the crumb is expected to return 403 — this is by
design. One such negative test per route is expected, to prove that
protection is actually applied and not accidentally bypassed.

## PR review checklist

When reviewing a change that adds a POST endpoint or form:

- [ ] The template renders the form through `{% call appForm(...) %}`, not a
      bare `<form method="post">`.
- [ ] Any new layout that imports `appForm` uses `with context`.
- [ ] POST tests for the route use `primeCrumb`, and at least one negative
      test asserts 403 when the crumb is missing.
- [ ] Any occurrence of `plugins: { crumb: false }` is accompanied by a PR
      description explaining what integrity check replaces crumb for that
      route.
