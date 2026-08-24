# Authentication

The frontend uses OIDC (OpenID Connect) Authorization Code flow with PKCE to authenticate users via Defra Identity.
Locally this runs against the **cdp-defra-id-stub**; deployed environments use the real Defra ID Azure B2C service.

## Local setup

### Prerequisites

The Defra ID stub must be running. It is defined in the **backend** compose file:

```shell
cd ../bng-metric-backend
docker compose up cdp-defra-id-stub redis -d
```

This starts the stub on `http://localhost:3200` (backed by Redis for session/registration storage).

### Register a test user in the stub

The stub does not ship with default users. You must register one through its UI:

1. Open `http://localhost:3200/cdp-defra-id-stub/register` in your browser.
2. Fill in the registration form (email, first name, last name, etc.).
3. After creating the user, add a **relationship** to the registration.
4. Within that relationship, add a **role** with:
   - **roleName**: `bng completer`
   - **roleStatus**: `3` — **Complete – approved**. This is required: the
     service treats any other status as unauthorised (see
     [Role checking](#role-checking)). A role left at `1` (Pending) lets you
     sign in but blocks every BNG page with "Access denied".
5. Note the email address you used - you will log in with it.

### Start the frontend

```shell
OIDC_USE_STUB=true npm run dev
```

The frontend runs on `http://localhost:3000`. The discovery URL, client ID, secret, and other defaults in `src/config/config.js` already point at the stub, so setting `OIDC_USE_STUB=true` is the only env var you need locally. See [Stub vs live OIDC](#stub-vs-live-oidc) below for what this flag changes.

### Test the login flow

1. Visit `http://localhost:3000` and click **Sign in**.
2. You are redirected to the stub's login page. Enter the email of the user you registered.
3. After authenticating, the stub redirects back to `/auth/callback`, which exchanges the authorization code for tokens and stores the user session.
4. You land on `/manage-projects`.
5. The **Sign out** link appears in the service navigation bar at the top of every page.

### Debugging

The login flow logs each milestone at **`info`**, so you can follow it at the
default log level without any extra config — see
[Logging & troubleshooting](#logging--troubleshooting) for the full set of
messages and what they mean. To additionally surface the high-frequency
per-request lines (`Auth scheme: checking session` and the role-pass line),
raise the level to `debug`:

```shell
OIDC_USE_STUB=true LOG_LEVEL=debug npm run dev
```

## Configuration

All OIDC settings are in `src/config/config.js` under the `oidc` key. Each has a sensible local default and can be overridden via environment variable for deployed environments.

| Config key                   | Env var                         | Local default                                                              | Description                                                                                                                                                                                     |
| ---------------------------- | ------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oidc.discoveryUrl`          | `OIDC_DISCOVERY_URL`            | `http://localhost:3200/cdp-defra-id-stub/.well-known/openid-configuration` | OIDC provider discovery endpoint                                                                                                                                                                |
| `oidc.clientId`              | `OIDC_CLIENT_ID`                | `63983fc2-cfff-45bb-8ec2-959e21062b9a`                                     | Application client ID (must match the provider). The default is the cdp-defra-id-stub's built-in value — **not a production credential**; deployed environments inject the real ID via env var. |
| `oidc.clientSecret`          | `OIDC_CLIENT_SECRET`            | `test_value`                                                               | Client secret                                                                                                                                                                                   |
| `oidc.redirectUri`           | `OIDC_REDIRECT_URI`             | `http://localhost:3000/auth/callback`                                      | Callback URL after authentication                                                                                                                                                               |
| `oidc.postLogoutRedirectUri` | `OIDC_POST_LOGOUT_REDIRECT_URI` | `http://localhost:3000/auth/signed-out`                                    | Landing page after logout                                                                                                                                                                       |
| `oidc.scopes`                | `OIDC_SCOPES`                   | `openid profile email offline_access`                                      | Scopes requested from the provider. Against live B2C the client ID is appended automatically (see `oidc.useStub`)                                                                               |
| `oidc.serviceId`             | `OIDC_SERVICE_ID`               | _(empty)_                                                                  | Defra ID service identifier (required for real B2C, ignored by stub)                                                                                                                            |
| `oidc.useStub`               | `OIDC_USE_STUB`                 | `false`                                                                    | Set `true` when the OIDC provider is the cdp-defra-id-stub (changes scope and nonce handling — see below)                                                                                       |

### Stub vs live OIDC

The `OIDC_USE_STUB` flag toggles two concrete behaviors that differ between the cdp-defra-id-stub and live Defra ID (Azure AD B2C):

| Behavior                           | `useStub=true` (stub)        | `useStub=false` (live B2C)                                 |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| Scope sent to `/authorize`         | `OIDC_SCOPES` as configured  | `OIDC_SCOPES` with the `clientId` appended                 |
| `expectedNonce` to `openid-client` | _not passed_                 | `pending.nonce` — strict comparison against ID token claim |
| Manual nonce fallback check        | runs if the stub emits nonce | skipped (library already validated)                        |

**Why these differ:**

- **Scope**: Azure AD B2C's `/token` endpoint returns a response without an `access_token` field unless the request includes a resource scope, and B2C uses the application's own client ID as that resource scope (see the [Microsoft B2C access-token docs](https://learn.microsoft.com/en-us/azure/active-directory-b2c/access-tokens#openid-connect-scopes); Defra's internal core-service onboarding guidance documents the same convention). Without it, `openid-client` rejects the token-endpoint response with `OAUTH_INVALID_RESPONSE` ("invalid response encountered"). The stub does not enforce this contract.
- **Nonce**: live B2C echoes the `nonce` we send in the authorization request as a claim in the ID token; the stub omits it. `openid-client` v6's auth-code grant has only two modes — "expect nonce" (strict) or "expect no nonce" (rejects any token containing one). There's no "ignore" mode, so we have to flip behavior based on which provider is on the other end.

### When to set `OIDC_USE_STUB`

| Scenario                                                                                                                     | `OIDC_USE_STUB`                   |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Local development against the cdp-defra-id-stub on `localhost:3200`                                                          | `true`                            |
| Deployed environment pointing at a stub instance (e.g. an integration env that doesn't yet have a Defra ID app registration) | `true`                            |
| Deployed environment using live Defra ID (dev / test / prod B2C tenants)                                                     | `false` _(default — leave unset)_ |

If you change which provider an environment points at (e.g. swap a dev env from stub to live B2C), update `OIDC_USE_STUB` alongside `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and `OIDC_SERVICE_ID`.

### Session lifetime configuration

How long a signed-in user's session lasts is controlled by a single environment variable, in **seconds**:

| Env var               | Default       | Description                                                                                                                                                                                                        |
| --------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SESSION_TTL_SECONDS` | `14400` (4 h) | Session lifetime as a **sliding idle-timeout**. Single source of truth — drives both the session cookie ttl and the server-side cache ttl (converted to ms once in `session-cache.js`) so the two can never drift. |

It is a _sliding_ timeout: authenticated requests renew the window (`touchSession`, called from the auth scheme), so an actively-used session never lapses and only genuine inactivity for `SESSION_TTL_SECONDS` ends it. The renewal is throttled to at most once per quarter of the window, so it does not turn every request into a session-store write. Because the IdP's tokens are much shorter-lived (~20 min), keep this comfortably **above** the token lifetime — a value below it would sign users out before the first silent refresh can bridge the gap. This single knob replaces the former millisecond-based `SESSION_CACHE_TTL` / `SESSION_COOKIE_TTL` pair (which could be set to different values and drift apart); set `SESSION_TTL_SECONDS` instead.

## How the auth flow works

### Login (`/auth/login`)

1. Generates a PKCE code verifier, code challenge (S256), random state, and nonce.
2. Stores `{ codeVerifier, state, nonce }` in the server-side yar session under the key `oidc`.
3. Builds the authorization URL using `openid-client` (passing `nonce` as a query parameter so the provider echoes it in the ID token) and redirects the browser to the provider.

### Callback (`/auth/callback`)

1. Reads the pending `oidc` data from yar. If missing, redirects to `/auth/login`.
2. Exchanges the authorization code for tokens via `authorizationCodeGrant`, validating PKCE and state.
3. **Nonce validation** — depends on `oidc.useStub`:
   - **Live B2C (`useStub=false`):** `expectedNonce` is passed to `authorizationCodeGrant`, so `openid-client` enforces the OIDC-spec rule that the ID token's `nonce` claim must equal the value sent in the auth request. Mismatch or missing claim throws and the callback fails.
   - **Stub (`useStub=true`):** `expectedNonce` is omitted (the stub does not emit `nonce` in the ID token, so passing it would make `openid-client` reject the response with `JWT "nonce" claim missing`). A manual fallback comparison runs only if the stub ever does include a `nonce` claim.
4. Stores `{ user: claims, idToken, refreshToken }` in yar under the key `auth`.
5. Clears the temporary `oidc` session data.
6. Redirects to `/manage-projects`.

### Session auth scheme

A custom Hapi auth scheme (`session`) is registered in `src/server/common/helpers/auth/auth-scheme.js`. It reads `request.yar.get('auth')` on each request:

- If a `user` object is present **and its `exp` claim is still in the future**, calls `h.authenticated({ credentials: user })` - the user's token claims become available as `request.auth.credentials`.
- If the token has expired (or is within 30 seconds of expiring), the scheme first attempts a silent refresh (see below) and authenticates with the refreshed claims on success.
- If there is no session at all, the destination depends on _why_ it is empty: a browser that never signed in is redirected to `/auth/forbidden`, but one whose expired session we already ended (it carries the `sessionEnded` breadcrumb - see below) is redirected to `/auth/session-expired`.
- If the token expired and the refresh failed, the session is cleared and the user is redirected to `/auth/session-expired`, which offers a "Sign in again" button.

Routes opt in by setting `auth: 'session'` in their options. It is **not** set as the default strategy - auth endpoints and health checks require no auth. Public pages that render the shared header (home, about, db-info) use `auth: { strategy: 'session', mode: 'try' }`: the page stays public, but the scheme still runs, so an expired session is refreshed - or cleared - before the header can present stale claims as a signed-in user (the nunjucks context reads the user straight from yar, so a public route with no auth option would skip the expiry check entirely). In `try` mode the scheme never redirects; it throws `Boom.unauthorized` so hapi continues unauthenticated and the page shows its signed-out state. **Convention: any new public page that renders the shared header must use `mode: 'try'`.**

### Session expiry & silent refresh (BMD-829, BMD-936)

The yar session deliberately outlives the IdP's tokens (live Defra ID ID tokens last ~20 minutes; the stub's last 1 hour). Its lifetime is the configurable sliding idle-timeout `SESSION_TTL_SECONDS` (default 4 hours — see [Session lifetime configuration](#session-lifetime-configuration)). The gap between the long session and the short token is bridged by silent refresh in two places:

1. **Proactively, in the auth scheme** - before each protected request, an expired token is renewed via `refreshSession()` (`refresh-session.js`), which performs an OIDC `refresh_token` grant and re-stores the new tokens and claims in yar. Refreshed claims are merged over the previous ones under two rules:
   - The **enrichment claims** — `roles`, `relationships`, `currentRelationshipId` — are **pinned to their sign-in values** and a refreshed token can never overwrite them. Defra ID (Azure B2C) runs its relationship/role enrichment only on interactive sign-in, so nothing a `refresh_token` grant returns in those three is authoritative.
   - Every **other** claim is taken from the refreshed token when meaningfully present, and kept from the previous claims when the refreshed token omits it or returns it blank.

   The second rule alone was the BMD-829 fix (an idle user kept their email but lost their organisation on the home page and hit "Access denied" everywhere while still looking signed in). It only stops an **empty** value overwriting a good one, which is why BMD-936 added the first: in the deployed environment Defra ID returns enrichment claims on refresh that are non-empty **yet different** — a `roles` collection flattened to a scalar, statuses that are no longer `3`, or a `currentRelationshipId` naming a different org from the one the user signed in under. Merging any of those produces a claim set that is individually plausible but internally inconsistent, and `hasBngCompleterRole` — an invariant **across** `roles` and `currentRelationshipId`, not a per-claim test — then failed it. That signed out users whose renewal had just succeeded, after ~20-40 minutes, in the deployed environment only (`Auth: silent refresh returned a session without the approved role, ending session`). Pinning removes the class: the authorisation decision after a refresh is identical to the one made at sign-in, by construction.

   This mirrors the backend, which authorises from the roles it persisted at sign-in rather than from token claims (`bng-metric-backend/src/db/project-visibility.js`). On both sides, a revoked role is picked up at the next interactive sign-in.

   The auth scheme still compares the pre- and post-refresh role decision, but only as a **tripwire**: a mismatch is now impossible, so it logs a warning naming `mergeRefreshedClaims` as regressed and keeps the session. Authorisation stays with the per-route `requireBngCompleterRole` gate.

2. **Reactively, around backend calls** - `backendRequest()` (`backend-request.js`) still handles a mid-request 401 from the backend (clock skew, key rotation, revocation): it refreshes once and retries. If that refresh fails, it clears the session and throws a Boom 401 flagged `data.sessionExpired`, which the global `catchAll` handler (`errors.js`) turns into a redirect to `/auth/session-expired` instead of rendering a "401 Unauthorized" error page.

Either way, a user whose session cannot be renewed ends up on `/auth/session-expired` - never on a generic error page, and never looking signed-in on pages that don't touch the backend.

There is a subtlety when the two steps span two page loads. A `try`-mode page (e.g. the home page) ends an unrefreshable session in place via `expireSession()` **without redirecting** - so when the user later clicks through to a protected route, the session store is already empty and looks identical to a browser that never signed in. To keep such a user on the friendly `/auth/session-expired` page rather than the blunt `/auth/forbidden` ("Access denied"), `expireSession()` leaves a `sessionEnded` breadcrumb in the fresh session (`session-expiry.js`); the auth scheme's "no user" branch reads it via `wasSessionEnded()` to choose between the two pages. The breadcrumb carries no user or tokens, so the shared header still renders signed-out.

#### Why a refresh fails (log categories)

A failed refresh logs `OIDC: silent token refresh failed [category=…]` (or `… no refresh token stored …`) with a matching `category` field and a short `likelyCause`, so CDP logs can be filtered without decoding raw OAuth codes (`classifyRefreshError` in `refresh-session.js`). The category is repeated **in the message** because CDP drops unmapped structured fields — without it every failure mode reads identically in OpenSearch and the tables below can't be used. The categories fall into two groups:

**Genuinely over - the `/auth/session-expired` page is the correct outcome, nothing to fix:**

| `category`               | What happened                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refresh-token-rejected` | `invalid_grant` - the refresh token expired, was revoked (password change, global sign-out), or was rotated and reused. Genuine **when the user was idle**. |

**Should have worked - a config / environment / policy problem that signs users out when they shouldn't be:**

| `category`                       | Points at                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refresh-token-rejected`         | Same `invalid_grant`, but firing reliably at the token-lifetime boundary (~20 min) means the **refresh-token lifetime is set too short / sliding window disabled** in the Defra ID policy, or a **rotation race** (we refresh both proactively in the auth scheme and reactively in `backendRequest`).                                                                            |
| `client-auth-failed`             | `invalid_client` / `unauthorized_client` - wrong or empty `OIDC_CLIENT_SECRET`, or confidential-vs-public client mismatch (we always send `client_secret_post`).                                                                                                                                                                                                                  |
| `scope-rejected`                 | `invalid_scope` - the refresh request's scope/resource doesn't match the original grant.                                                                                                                                                                                                                                                                                          |
| `idp-unreachable`                | Network failure (`ENOTFOUND`, `ECONNREFUSED`, TLS, proxy) - the CDP egress proxy / DNS / TLS path to Defra ID, not an OAuth error.                                                                                                                                                                                                                                                |
| `no-refresh-token`               | The provider issued no refresh token at all - `offline_access` not effective, or a policy that withholds it.                                                                                                                                                                                                                                                                      |
| `no-id-token`                    | The grant succeeded but returned no `id_token`. The id_token _is_ the session (it carries the `exp` the expiry check reads, and it is the bearer credential sent to the backend), so there is nothing to renew with — check the Defra ID policy issues one on the refresh flow and that `OIDC_SCOPES` still carries `openid`. The session ends and the user gets "Sign in again". |
| `oauth-error` / `refresh-failed` | Any other OAuth error / unclassified failure - read the `err` and `detail` fields.                                                                                                                                                                                                                                                                                                |

#### Reading a successful refresh (enrichment shapes)

CDP's log ingestion keeps message text but **drops non-allowlisted structured
fields**, so in a deployed environment the `category`, `sub` and `detail` fields
above are not visible — only the message is. (This is the same constraint that
makes `logging/logger-options.js` prefix `session.id` onto the message rather
than emit it as a field.) Diagnostics that need to survive to OpenSearch
therefore go **in the message**.

A successful refresh logs the shape of each pinned enrichment claim as the
refreshed token carried it:

```
OIDC: silently refreshed session tokens [roles=array:1 relationships=array:1 currentRelationshipId=scalar(differs:unknown)]
```

| Shape         | Meaning                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| `absent`      | The refreshed token omitted the claim                                          |
| `array:N`     | A collection with N entries (`array:0` is the BMD-829 empty-array shape)       |
| `string:0`    | Present but an empty string — the BMD-829 empty-scalar shape                   |
| `scalar`      | A non-empty **string** where a collection is expected — B2C has flattened it   |
| `(differs:…)` | The value differs from the one pinned at sign-in — see the drift classes below |

Values are never logged — role and relationship strings carry org ids and names.
Any `scalar` or `(differs…)` marker is a claim that would have overwritten a good
sign-in value before BMD-936 pinned them; it is now informational only.

When a claim differs, the marker says **how**. This is what separates a fault at
the identity provider from an over-strict comparison on our side:

| Drift class                  | Meaning and what to do                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `differs:case-only`          | The **same id**, differently cased. Not an IdP fault — `verify-role.js` compares relationship ids case-sensitively (it lower-cases the role _name_ only), so this alone ended sessions pre-BMD-936. Fix by normalising here. |
| `differs:format-only`        | The same id wearing `{braces}` or whitespace. Same conclusion as `case-only`.                                                                                                                                                |
| `differs:known-relationship` | A different relationship the user genuinely holds, per their pinned `relationships`/`roles`. Only possible for a multi-relationship user.                                                                                    |
| `differs:unknown`            | An id we hold **no record of**. The one class that points at Defra ID rather than at our comparison — and the only one consistent with a single-relationship user seeing drift.                                              |
| `differs:previously-absent`  | The claim was missing or empty at sign-in, so there was nothing to compare against.                                                                                                                                          |
| `differs`                    | The two sides aren't both strings (e.g. an array flattened to a scalar), so an id-to-id comparison doesn't apply.                                                                                                            |

The classification is derived from values already in the session; none of them
are written to the log.

`detail` always carries the raw evidence (`oauthError=`, `oauthErrorDescription=`, HTTP/cause codes, response body), PII-free.

### Role checking

The pre-handler in `src/server/common/helpers/auth/verify-role.js` inspects the authenticated user's `roles` array. Defra ID tokens contain roles as colon-delimited strings in the format:

```
relationshipId:roleName:roleStatus
```

For example: `23950a2d-...:bng completer:3`

The `hasBngCompleterRole()` helper requires an **approved** role: the role name (middle segment, case-insensitive and trimmed) must be `bng completer` **and** the status (last segment) must be `3` (Complete – approved). When the token carries a `currentRelationshipId`, the approved role must belong to that relationship — matching the backend, which scopes project visibility per relationship. Any other status (`1`, `2`, `4`–`7`) — pending, rejected, or removed — is treated as unauthorised and the user is redirected to `/auth/forbidden`.

> **Why approval matters end to end:** the backend independently verifies the same id_token and only returns projects whose relationship has an approved (status 3) role (`bng-metric-backend/src/db/project-visibility.js`). Without this front-end gate, a pending user would sign in, reach the pages, and then see empty lists / 404s from the backend. Gating on approval turns that into a clear "Access denied" instead. See [Authenticated user journey](./authenticated-user-journey.md) for the full lifecycle.

### Logout (`/auth/logout`)

1. Reads the `idToken` from the yar session.
2. Resets the entire yar session.
3. Builds the provider's end-session URL with `id_token_hint` and `post_logout_redirect_uri`.
4. Redirects the browser to the provider's logout endpoint, which then redirects back to `/auth/signed-out`.

## Securing new routes

To protect a new route with authentication and the `bng completer` role check, follow this pattern in your route plugin file:

```js
import { myController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const myFeature = {
  plugin: {
    name: 'myFeature',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/my-route',
          ...myController,
          options: {
            ...myController.options,
            ...protectedRouteOptions
          }
        }
      ])
    }
  }
}
```

### What each part does

- **`auth: 'session'`** - Requires a valid yar session with user credentials. Unauthenticated requests receive a 401 response (handled by the error page).
- **`pre: [requireBngCompleterRole]`** - Runs before the handler. Checks `request.auth.credentials.roles` for the `bng completer` role. If missing, redirects to `/auth/forbidden` with a takeover response.
- **`...myController.options`** - Preserves any existing options the controller defines (e.g., validation).

### Auth-only (no role check)

If a route only needs authentication without a specific role:

```js
{
  method: 'GET',
  path: '/my-route',
  ...myController,
  options: {
    ...myController.options,
    auth: 'session'
  }
}
```

### Accessing user data in handlers

Inside a protected handler, the authenticated user's token claims are available at:

```js
const userId = request.auth.credentials.sub
const email = request.auth.credentials.email
const roles = request.auth.credentials.roles
```

### Public routes

Routes that should remain accessible without login do not need any `auth` option. To be explicit:

```js
options: {
  auth: false
}
```

### Testing protected routes

When testing with `server.inject()`, provide auth credentials to bypass the session check:

```js
const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user-123',
    email: 'test@example.com',
    // Status must be 3 (approved) — requireBngCompleterRole now rejects any
    // other status and redirects to /auth/forbidden.
    roles: ['aaa-bbb:bng completer:3']
  }
}

const { statusCode } = await server.inject({
  method: 'GET',
  url: '/my-route',
  auth: authedAuth
})
```

## Logging & troubleshooting

The whole login flow emits structured logs at **`info`**, so a full attempt is
traceable in OpenSearch/Grafana at the default `LOG_LEVEL`. Every line carries
the CDP `trace.id`, so filter by a single `trace.id` to follow one attempt end
to end. A healthy login looks like:

```
OIDC login: initiating authorization code flow            (discoveryUrl, clientId, redirectUri, scope, serviceId, useStub)
OIDC discovery: fetching provider configuration           (first attempt only — the config is cached)
OIDC discovery: provider configuration loaded
OIDC login: redirecting to identity provider authorization endpoint  (authorizationHost, state)
OIDC callback: received authorization response, exchanging code for tokens
OIDC callback: token exchange succeeded                   (sub, roleCount, hasIdToken, hasRefreshToken)
OIDC callback: session established, redirecting to /manage-projects
```

When something breaks, look for these signals instead:

| Log (level)                                                                     | Likely cause                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OIDC discovery failed for …` (error)                                           | `OIDC_DISCOVERY_URL` wrong/unreachable, or TLS/proxy issue reaching Defra ID                                                                                              |
| `OIDC login: initiating …` shows an unexpected `clientId`/`scope`/`redirectUri` | Wrong `OIDC_CLIENT_ID` / `OIDC_SCOPES` / `OIDC_REDIRECT_URI` env value                                                                                                    |
| `OIDC callback: identity provider returned an error response` (warn)            | Defra ID rejected the request — read `error` / `errorDescription` (e.g. `invalid_client`, `unauthorized_client`, consent failure)                                         |
| `OIDC callback: no pending login state in session …` (warn)                     | The session cookie didn't survive the round-trip — check `SESSION_COOKIE_SECURE` vs scheme, `SameSite`, Redis reachability. This is the classic silent **redirect loop**. |
| `OIDC callback failed :: …` (error)                                             | Token exchange/validation failed — the message includes `code`, `causeCode`, `causeMessage`, `causeBody`, `causeClaims` from `openid-client`                              |
| `Role check failed: user lacks the bng completer role …` (warn)                 | Auth succeeded but the user has no `bng completer` role — the `roles` field shows what the token actually carried                                                         |
| `Auth: request has no authenticated session …` (info)                           | A protected route was hit without a valid session                                                                                                                         |
| `Auth: refreshed claims lost the approved role but the session was kept` (warn) | Tripwire — should be unreachable. `mergeRefreshedClaims` has stopped pinning the enrichment claims (see BMD-936 above)                                                    |

For the high-frequency per-request session check (`Auth scheme: checking
session`) and the role-pass line, set `LOG_LEVEL=debug` to make them visible.

## Key files

| File                                                | Purpose                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/config/config.js`                              | OIDC configuration (discovery URL, client ID, scopes, etc.)                  |
| `src/server/common/helpers/auth/oidc-client.js`     | Lazy singleton for OIDC provider discovery                                   |
| `src/server/common/helpers/auth/auth-scheme.js`     | Custom Hapi auth scheme reading yar sessions                                 |
| `src/server/common/helpers/auth/session-expiry.js`  | Token `exp` check + session clearing helpers                                 |
| `src/server/common/helpers/auth/refresh-session.js` | Silent OIDC `refresh_token` grant                                            |
| `src/server/common/helpers/auth/backend-request.js` | Bearer-authenticated backend calls with 401 retry                            |
| `src/server/common/helpers/auth/verify-role.js`     | Role parsing and `requireBngCompleterRole` pre-handler                       |
| `src/server/auth/controller.js`                     | Login, callback, logout, signed-out, forbidden, and session-expired handlers |
| `src/server/auth/index.js`                          | Auth route plugin (`/auth/login`, `/auth/callback`, etc.)                    |
| `src/server/auth/forbidden.njk`                     | 403 "Access denied" template                                                 |
| `src/server/auth/signed-out.njk`                    | Post-logout template                                                         |
| `src/server/auth/session-expired.njk`               | Session-expired template with "Sign in again" button                         |
