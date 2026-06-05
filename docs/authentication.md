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
   - **roleStatus**: `1` (or any non-zero value)
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

- If a `user` object is present, calls `h.authenticated({ credentials: user })` - the user's token claims become available as `request.auth.credentials`.
- If not, returns `h.unauthenticated(Boom.unauthorized())`.

Routes opt in by setting `auth: 'session'` in their options. It is **not** set as the default strategy - public routes (home page, auth endpoints, health checks) require no auth.

### Role checking

The pre-handler in `src/server/common/helpers/auth/verify-role.js` inspects the authenticated user's `roles` array. Defra ID tokens contain roles as colon-delimited strings in the format:

```
relationshipId:roleName:roleStatus
```

For example: `23950a2d-...:bng completer:3`

The `hasBngCompleterRole()` helper parses the second segment (case-insensitive, trimmed) and checks for `bng completer`. If the role is missing, the user is redirected to `/auth/forbidden`.

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
    roles: ['aaa-bbb:bng completer:1']
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

For the high-frequency per-request session check (`Auth scheme: checking
session`) and the role-pass line, set `LOG_LEVEL=debug` to make them visible.

## Key files

| File                                            | Purpose                                                     |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `src/config/config.js`                          | OIDC configuration (discovery URL, client ID, scopes, etc.) |
| `src/server/common/helpers/auth/oidc-client.js` | Lazy singleton for OIDC provider discovery                  |
| `src/server/common/helpers/auth/auth-scheme.js` | Custom Hapi auth scheme reading yar sessions                |
| `src/server/common/helpers/auth/verify-role.js` | Role parsing and `requireBngCompleterRole` pre-handler      |
| `src/server/auth/controller.js`                 | Login, callback, logout, signed-out, and forbidden handlers |
| `src/server/auth/index.js`                      | Auth route plugin (`/auth/login`, `/auth/callback`, etc.)   |
| `src/server/auth/forbidden.njk`                 | 403 "Access denied" template                                |
| `src/server/auth/signed-out.njk`                | Post-logout template                                        |
