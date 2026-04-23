# User-context authentication (signer side)

## Purpose

Every backend call from the frontend carries a signed `x-user-context` header naming the authenticated end user. This:

1. Reinforces the architectural rule that the FE is the only legitimate caller of the BE.
2. Gives the backend an attributable identity for audit logs and ownership checks, without trusting `userId` values pulled from the request body or path.
3. Bounds the compromise window of any leaked signing key to a single rotation epoch.

## When it is applied

Every call made via `src/server/common/services/backend-client.js`. **Any direct `Wreck` or `fetch` call to the backend is a bug** — it bypasses the signing wrapper and will fail authentication once `USER_CONTEXT_ENFORCE` is on.

## How `userId` is sourced

`backendClient(request)` reads:

- `userId` from `request.auth.credentials.sub` — the OIDC subject claim, copied into session at login.
- `sid` from `request.yar.id` — the frontend session identifier.

**Never** mint a header from a `userId` taken from request input. The whole point of the scheme is that the BE can trust the header more than it trusts the request body.

If the request has no authenticated user (`credentials.sub` missing), the wrapper omits the header rather than minting an invalid one. The request will then either succeed (allowlisted route) or be rejected by the BE.

## Flow

```
FE                                  BE
--                                  --
derive K = HKDF(root, "bng-ctx-v1:"+epoch)
sign payload with K
send  x-user-context: body.sig  --> read epoch from payload
                                    derive K from same root + epoch
                                    HMAC-verify body
                                    accept / reject
```

## Token format

```
<base64url(JSON payload)>.<base64url(HMAC-SHA256 over base64url body)>
```

Payload fields:

| Field    | Type   | Meaning                                                     |
| -------- | ------ | ----------------------------------------------------------- |
| `userId` | string | OIDC `sub` of the authenticated user                        |
| `sid`    | string | Frontend session identifier                                  |
| `iat`    | number | Unix seconds when the token was minted                      |
| `exp`    | number | Unix seconds after which the token must be rejected         |
| `epoch`  | number | `floor(iat / rotationPeriodSeconds)` — selects the HMAC key |

## Key derivation

- HKDF-SHA256, output 32 bytes.
- Salt: empty.
- Info string: `bng-ctx-v1:<epoch>`.
- Epoch: `floor(unixSeconds / rotationPeriodSeconds)`.

## Rotation

- **Per-epoch (automatic):** every `rotationPeriodSeconds` (default 1 hour) the derived key changes. No deploy or restart required.
- **Root rotation (manual):** set a new `USER_CONTEXT_ROOT_SECRET` on both services in a coordinated release.

## Configuration

| Key                                  | Env var                              | Default                                                  | Notes                                        |
| ------------------------------------ | ------------------------------------ | -------------------------------------------------------- | -------------------------------------------- |
| `userContext.rootSecret`             | `USER_CONTEXT_ROOT_SECRET`           | `local-dev-only-root-secret-change-me-per-environment`   | **MUST** override per environment            |
| `userContext.rotationPeriodSeconds`  | `USER_CONTEXT_ROTATION_PERIOD_SECONDS` | `3600`                                                 | Both services must agree                     |
| `userContext.tokenTtlSeconds`        | `USER_CONTEXT_TOKEN_TTL_SECONDS`     | `60`                                                     | How long each minted token is valid          |
| `userContext.clockSkewEpochs`        | `USER_CONTEXT_CLOCK_SKEW_EPOCHS`     | `1`                                                      | Verifier-only on BE; kept for shape parity   |

## Failure modes (as seen from the FE)

| Symptom            | Cause                                          | What to check                                 |
| ------------------ | ---------------------------------------------- | --------------------------------------------- |
| 401 from BE        | `USER_CONTEXT_ROOT_SECRET` differs FE↔BE       | Both services have the same env value         |
| 401 from BE        | `rotationPeriodSeconds` differs FE↔BE          | Both services have the same env value         |
| 401 from BE        | Significant clock skew between FE and BE hosts | Sync NTP                                      |
| 403 from BE        | Signed `userId` doesn't match handler invariant | Caller passed a `userId` that isn't `credentials.sub` |

## Code guide

Adding a new backend call:

```js
import { backendClient } from '../common/services/backend-client.js'

const { payload } = await backendClient(request).get('/projects/123', {
  json: true
})
```

Use `.get`, `.post`, `.put`, or `.delete`. Pass any Wreck options through unchanged — the wrapper merges in the `x-user-context` header.

## Bootstrapping local dev

The default `rootSecret` is intentionally identical across both projects so `docker compose up` and `npm run dev` work with no setup. **The default must never be used in any deployed environment.**
