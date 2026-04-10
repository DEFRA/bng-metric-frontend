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
npm run dev
```

The frontend runs on `http://localhost:3000`. No extra environment variables are needed for local development - the defaults in `src/config/config.js` point at the stub.

### Test the login flow

1. Visit `http://localhost:3000` and click **Sign in**.
2. You are redirected to the stub's login page. Enter the email of the user you registered.
3. After authenticating, the stub redirects back to `/auth/callback`, which exchanges the authorization code for tokens and stores the user session.
4. You land on `/project-dashboard`.
5. The **Sign out** link appears in the service navigation bar at the top of every page.

### Debugging

Run with debug logging to see auth-related messages:

```shell
LOG_LEVEL=debug npm run dev
```

Key log messages:

- `Auth scheme: checking session` - logged on every request to a protected route, shows whether a session was found.
- `OIDC callback: token exchange succeeded` - logged after successful code exchange, includes `sub`, `roles`, and whether a nonce was present.
- `Role check: inspecting credentials` - logged by the route pre-handler, shows the roles array from the token.

## Configuration

All OIDC settings are in `src/config/config.js` under the `oidc` key. Each has a sensible local default and can be overridden via environment variable for deployed environments.

| Config key                   | Env var                         | Local default                                                              | Description                                                          |
| ---------------------------- | ------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `oidc.discoveryUrl`          | `OIDC_DISCOVERY_URL`            | `http://localhost:3200/cdp-defra-id-stub/.well-known/openid-configuration` | OIDC provider discovery endpoint                                     |
| `oidc.clientId`              | `OIDC_CLIENT_ID`                | `63983fc2-cfff-45bb-8ec2-959e21062b9a`                                     | Application client ID (must match the provider)                      |
| `oidc.clientSecret`          | `OIDC_CLIENT_SECRET`            | `test_value`                                                               | Client secret                                                        |
| `oidc.redirectUri`           | `OIDC_REDIRECT_URI`             | `http://localhost:3000/auth/callback`                                      | Callback URL after authentication                                    |
| `oidc.postLogoutRedirectUri` | `OIDC_POST_LOGOUT_REDIRECT_URI` | `http://localhost:3000/auth/signed-out`                                    | Landing page after logout                                            |
| `oidc.scopes`                | `OIDC_SCOPES`                   | `openid profile email offline_access`                                      | Scopes requested from the provider                                   |
| `oidc.serviceId`             | `OIDC_SERVICE_ID`               | _(empty)_                                                                  | Defra ID service identifier (required for real B2C, ignored by stub) |

## How the auth flow works

### Login (`/auth/login`)

1. Generates a PKCE code verifier, code challenge (S256), random state, and nonce.
2. Stores `{ codeVerifier, state, nonce }` in the server-side yar session under the key `oidc`.
3. Builds the authorization URL using `openid-client` and redirects the browser to the provider.

### Callback (`/auth/callback`)

1. Reads the pending `oidc` data from yar. If missing, redirects to `/auth/login`.
2. Exchanges the authorization code for tokens via `authorizationCodeGrant`, validating PKCE and state.
3. If the ID token contains a `nonce` claim, validates it matches the stored nonce (the stub omits it; the live service includes it).
4. Stores `{ user: claims, idToken, refreshToken }` in yar under the key `auth`.
5. Clears the temporary `oidc` session data.
6. Redirects to `/project-dashboard`.

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
