# Stub test users (`seed-stub-users.mjs`)

A helper that registers a spread of test users into the local
**cdp-defra-id-stub** so you can exercise every authentication and RBAC path —
Citizen / Employee / Agent relationships, approved vs. unapproved roles,
single- and multi-organisation users, MFA / level-of-assurance variations, and
the stub's own quirks — without hand-registering anyone through the stub UI.

It complements [authenticated-user-journey.md](./authenticated-user-journey.md)
(what happens once a user is signed in) and
[authentication.md](./authentication.md) (the OIDC login mechanics). The Defra ID
field shapes used here come from the _Technical onboarding guide for core
service_ (DEFRA Common Platform), reconciled with how the stub actually behaves.

## Quick start

```sh
# 1. Bring up the stub (it ships with the backend's compose stack)
(cd ../bng-metric-backend && docker compose up -d cdp-defra-id-stub)

# 2. Register the test users
npm run seed:stub-users
```

The script prints, for every user, the **login email** and a description of what
that user lets you test, grouped by expected outcome (access granted / denied /
depends on the organisation picked).

| Flag / env          | Effect                                                   |
| ------------------- | -------------------------------------------------------- |
| `--dry-run`         | Print the payloads and summary without calling the stub. |
| `--url=<stubUrl>`   | Target a different stub base URL.                        |
| `DEFRA_ID_STUB_URL` | Same as `--url` (env form).                              |
| `--help`, `-h`      | Usage.                                                   |

Default stub URL: `http://localhost:3200/cdp-defra-id-stub`.

## The users

Access to the BNG service requires an **approved (status 3) `bng completer`**
role for the organisation the user is currently acting under (see
`src/server/common/helpers/auth/verify-role.js`). Every user below is built to
prove one facet of that rule.

| Login email                          | Relationship   | Key settings                                     | Expected   | What it tests                                                               |
| ------------------------------------ | -------------- | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------- |
| `employee.approved@bng.example.com`  | Employee       | 1 org · completer **3** · loa 2                  | ✅ access  | Standard happy path; single org, no picker.                                 |
| `agent.approved@bng.example.com`     | Agent          | 1 org · completer **3**                          | ✅ access  | Approved access in an agent (not employee) context.                         |
| `citizen.approved@bng.example.com`   | Citizen        | self · completer **3** · loa 3                   | ✅ access  | Individual acting as themselves, highest LoA.                               |
| `multi.org@bng.example.com`          | Employee+Agent | 2 orgs · both completer **3**                    | ✅ access  | Organisation picker; either choice grants access.                           |
| `mfa.user@bng.example.com`           | Employee       | completer **3** · **aal 2** · loa 3              | ✅ access  | MFA / high-assurance journey.                                               |
| `reselection.hint@bng.example.com`   | Employee       | completer **3** · enrolmentCount **2** > roles 1 | ✅ access  | Models "reselection possible": roles on an unselected org.                  |
| `pending.enrolment@bng.example.com`  | Employee       | completer **2 (Pending)**                        | ⛔ denied  | Role present but not approved → `/auth/forbidden`.                          |
| `rejected.enrolment@bng.example.com` | Employee       | completer **4 (Rejected)**                       | ⛔ denied  | Rejected enrolment.                                                         |
| `access.removed@bng.example.com`     | Employee       | completer **6 (Access removed)**                 | ⛔ denied  | Loss of access via a status update (role stays in the token).               |
| `wrong.role@bng.example.com`         | Employee       | **`bng viewer`** status 3                        | ⛔ denied  | Approved but wrong role name — access is gated on the name too.             |
| `no.relationships@bng.example.com`   | —              | no relationships                                 | ⛔ denied  | No org context, no roles, no picker.                                        |
| `word.status@bng.example.com`        | Employee       | completer status **`complete`** (a word)         | ⛔ denied  | The stub-UI quirk (see below): non-numeric status is dropped, not 500.      |
| `org.mismatch@bng.example.com`       | Employee+Agent | Northfield **2 (pending)** + Southbank **3**     | ⚠️ depends | Per-org scoping: pick the pending org → denied; pick the approved → access. |

Statuses 1/5/7 (Incomplete / Blocked / Offboarded) behave exactly like the
denied users above — only status 3 grants access.

## Logging in as a test user

1. Run the full stack (e.g. `npm run dev` in the harness, with the backend
   compose services up) and open the frontend at `http://localhost:3000`.
2. Start the sign-in journey. The stub shows a login page listing every
   registered user.
3. Click the **email** of the user you want.
4. A user with **one** organisation is taken straight through (auto-selected). A
   user with **two** organisations is shown the **organisation picker** — choose
   one to set the current relationship.

The stub remembers the last user via an SSO session. To switch users, use the
**Expire** link next to a user on the stub login page
(`http://localhost:3200/cdp-defra-id-stub/login`), or open a fresh
private/incognito window.

## Defra ID reference (what the token carries)

The stub issues a JWT whose `relationships` and `roles` claims are arrays of
**colon-delimited strings** (the service parses these in
`bng-metric-backend/src/services/defra-id/claims.js`):

```
relationship: relationshipId:organisationId:organisationName:organisationLoa:relationship:relationshipLoa
role:         relationshipId:roleName:status
```

- **relationship** (how the user relates to the org): `Citizen` (acting as
  themselves), `Employee` (employee of the org), or `Agent` (acting on behalf of
  the org).
- **role status** — a numeric enum; only `3` grants access:

  | Code | Meaning             | Code | Meaning        |
  | ---- | ------------------- | ---- | -------------- |
  | 1    | Incomplete          | 5    | Blocked        |
  | 2    | Pending             | 6    | Access removed |
  | 3    | Complete (approved) | 7    | Offboarded     |
  | 4    | Complete (rejected) |      |                |

- **loa** — level of assurance about the user's identity (0–3).
- **aal** — authentication assurance level: `1` (password only) or `2` (MFA).
- **enrolmentCount** / **enrolmentRequestCount** — totals across all of the
  user's organisations; when `enrolmentCount` exceeds the number of `roles` in
  the token, the user has roles on an organisation they have not currently
  selected.

## Stub quirks the script works around

The stub is a convenience, not a faithful Azure AD B2C. The script papers over
several differences so the registered data matches what real Defra ID would
send:

1. **Word-valued statuses.** The stub's _registration UI_ submits role status as
   a word (`complete`, `pending`, …), not the numeric code. The script sends the
   **numbers** via the API, as real Defra ID does. (`word.status@…` deliberately
   keeps a word to prove the parser now drops it cleanly rather than crashing on
   `NaN`.)
2. **Positive enrolment counts.** The stub validates `enrolmentCount` and
   `enrolmentRequestCount` as _positive_ integers, so the floor is `1` even for a
   user with no enrolments.
3. **`organisationId` mirrors `relationshipId`.** The register API ignores any
   `organisationId` you send and reuses the `relationshipId`.
4. **First relationship is "current".** On registration the first relationship
   becomes `currentRelationshipId`; at login the organisation picker overrides
   this for multi-org users (single-org users are auto-selected).
5. **One role per relationship.** A relationship carries a single
   `roleName`/`roleStatus`. To give a user multiple roles, give them multiple
   relationships.
6. **Parallel relationship inserts race.** The stub adds a payload's
   relationships concurrently through a non-atomic cached list, so putting two or
   more relationships in one `POST` loses all but one. The script therefore POSTs
   relationships **one at a time** and clears existing ones by id first.

## Conflicts and re-runs

Re-running is safe and idempotent. Each user has a **deterministic id** derived
from its email, so the script:

- removes the user's existing relationships by id (clearing any duplicates), then
- POSTs each relationship individually — a conflicting registration is replaced
  in place rather than duplicated.

Each line of output is labelled `created` (new) or `replaced` (already existed).
If the stub is unreachable the script explains how to start it and exits non-zero
without partially writing.

## Extending the matrix

Add an entry to the `USERS` array in
[`scripts/seed-stub-users.mjs`](../scripts/seed-stub-users.mjs). Each user lists
one or more `relationships` (first = current), an `expect`
(`access` / `denied` / `mixed`) that groups it in the summary, and a `tests`
description. Use the `STATUS` and `RELATIONSHIP` constants rather than raw
values, and run `npm run seed:stub-users -- --dry-run` to preview.
