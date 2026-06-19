// Seed a range of test users into the local CDP Defra ID stub via its
// `API/register` endpoint, then print each user's login email and what it lets
// you test. Re-running is safe: each user has a deterministic id, so the stub
// replaces it in place rather than creating duplicates.
//
// Usage:
//   node scripts/seed-stub-users.mjs            # register against the local stub
//   node scripts/seed-stub-users.mjs --dry-run  # print payloads, register nothing
//   node scripts/seed-stub-users.mjs --url=http://host:3200/cdp-defra-id-stub
//   DEFRA_ID_STUB_URL=... node scripts/seed-stub-users.mjs
//
// See docs/stub-test-users.md for the full reference (token shapes, the role
// status enum, the stub quirks this script works around, and how to log in).

import { createHash } from 'node:crypto'

// --- Defra ID reference values (from the core-service onboarding guide) -------

// relationship: how the user is related to the organisation.
const RELATIONSHIP = {
  CITIZEN: 'Citizen', // acting as themselves
  EMPLOYEE: 'Employee', // acting as an employee of the organisation
  AGENT: 'Agent' // acting as an agent on behalf of the company
}

// Role status enum (relationshipId:roleName:status). Only status 3 grants
// access in this service; every other value denies. The stub's own
// registration UI emits these as WORDS, but the API (and real Defra ID) use the
// numeric code — so we send the numbers.
const STATUS = {
  INCOMPLETE: '1',
  PENDING: '2',
  APPROVED: '3',
  REJECTED: '4',
  BLOCKED: '5',
  REMOVED: '6',
  OFFBOARDED: '7'
}

const STATUS_LABEL = {
  1: 'Incomplete',
  2: 'Pending',
  3: 'Complete (approved)',
  4: 'Complete (rejected)',
  5: 'Blocked',
  6: 'Access removed',
  7: 'Offboarded'
}

// The only role name that grants access to the BNG service (see frontend
// src/server/common/helpers/auth/verify-role.js).
const COMPLETER = 'bng completer'

const DEFAULT_STUB_URL = 'http://localhost:3200/cdp-defra-id-stub'

// --- Test user matrix --------------------------------------------------------
//
// Each user lists one or more relationships; the FIRST relationship is the one
// the stub marks as current. `expect` drives how the summary groups the user:
//   'access'  always reaches the service
//   'denied'  always redirected to /auth/forbidden
//   'mixed'   depends on which organisation is picked at login

const USERS = [
  {
    email: 'employee.approved@bng.example.com',
    firstName: 'Erin',
    lastName: 'Employee',
    loa: '2',
    aal: '1',
    relationships: [
      {
        org: 'Greenfield Developments Ltd',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        status: STATUS.APPROVED
      }
    ],
    expect: 'access',
    tests:
      'Standard happy path — an employee with a single approved "bng ' +
      'completer" role. One relationship, so no organisation picker.'
  },
  {
    email: 'agent.approved@bng.example.com',
    firstName: 'Aamir',
    lastName: 'Agent',
    loa: '1',
    aal: '1',
    relationships: [
      {
        org: 'Riverside Ecology Consultants',
        role: RELATIONSHIP.AGENT,
        roleName: COMPLETER,
        status: STATUS.APPROVED
      }
    ],
    expect: 'access',
    tests:
      'Agent acting on behalf of an organisation with an approved role — ' +
      'access granted in an agent (not employee) context.'
  },
  {
    email: 'citizen.approved@bng.example.com',
    firstName: 'Cara',
    lastName: 'Citizen',
    loa: '3',
    aal: '1',
    relationships: [
      {
        org: 'Cara Citizen (self)',
        role: RELATIONSHIP.CITIZEN,
        roleName: COMPLETER,
        status: STATUS.APPROVED
      }
    ],
    expect: 'access',
    tests:
      'Citizen acting as themselves (e.g. an individual landowner) with an ' +
      'approved role, at the highest level of assurance (loa 3).'
  },
  {
    email: 'multi.org@bng.example.com',
    firstName: 'Morgan',
    lastName: 'Multi',
    loa: '2',
    aal: '1',
    relationships: [
      {
        org: 'Acme Estates Ltd',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        status: STATUS.APPROVED
      },
      {
        org: 'Brook Consulting LLP',
        role: RELATIONSHIP.AGENT,
        roleName: COMPLETER,
        status: STATUS.APPROVED
      }
    ],
    expect: 'access',
    tests:
      'Two organisations, both with approved roles — exercises the ' +
      'organisation picker and per-relationship scoping. Either choice works.'
  },
  {
    email: 'mfa.user@bng.example.com',
    firstName: 'Mina',
    lastName: 'Mfa',
    loa: '3',
    aal: '2',
    relationships: [
      {
        org: 'Highgrove Land Partners',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        status: STATUS.APPROVED
      }
    ],
    expect: 'access',
    tests:
      'High-assurance journey — aal 2 (MFA used) and loa 3. Approved role, ' +
      'so access is granted; use to check AAL/LoA handling.'
  },
  {
    email: 'reselection.hint@bng.example.com',
    firstName: 'Remi',
    lastName: 'Reselect',
    loa: '2',
    aal: '1',
    enrolmentCount: 2,
    enrolmentRequestCount: 1,
    relationships: [
      {
        org: 'Meadowbank Developments',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        status: STATUS.APPROVED
      }
    ],
    expect: 'access',
    tests:
      'Models the guide\'s "reselection possible" example: enrolmentCount (2) ' +
      'exceeds the number of roles (1), signalling roles on an organisation ' +
      'that is not currently selected.'
  },
  {
    email: 'pending.enrolment@bng.example.com',
    firstName: 'Pat',
    lastName: 'Pending',
    loa: '1',
    aal: '1',
    relationships: [
      {
        org: 'Oakfield Homes Ltd',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        status: STATUS.PENDING
      }
    ],
    expect: 'denied',
    tests:
      'Enrolment pending (status 2) — the role exists but is not approved, so ' +
      'the user is redirected to /auth/forbidden. (Statuses 1/4/5/6/7 behave ' +
      'the same; see the rejected/removed users.)'
  },
  {
    email: 'rejected.enrolment@bng.example.com',
    firstName: 'Reese',
    lastName: 'Rejected',
    loa: '1',
    aal: '1',
    relationships: [
      {
        org: 'Thornbury Estates',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        status: STATUS.REJECTED
      }
    ],
    expect: 'denied',
    tests: 'Enrolment rejected (status 4) — role present but denied access.'
  },
  {
    email: 'access.removed@bng.example.com',
    firstName: 'Robin',
    lastName: 'Removed',
    loa: '1',
    aal: '1',
    relationships: [
      {
        org: 'Westmoor Land Co',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        status: STATUS.REMOVED
      }
    ],
    expect: 'denied',
    tests:
      'Access removed (status 6) — models loss of access arriving as a status ' +
      'update rather than the role disappearing from the token.'
  },
  {
    email: 'wrong.role@bng.example.com',
    firstName: 'Wren',
    lastName: 'Wrongrole',
    loa: '1',
    aal: '1',
    relationships: [
      {
        org: 'Sparrow Surveying Ltd',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: 'bng viewer',
        status: STATUS.APPROVED
      }
    ],
    expect: 'denied',
    tests:
      'Approved (status 3) but the WRONG role name ("bng viewer") — proves ' +
      'access is gated on the role name, not just an approved status.'
  },
  {
    email: 'no.relationships@bng.example.com',
    firstName: 'Noor',
    lastName: 'Norole',
    loa: '1',
    aal: '1',
    relationships: [],
    expect: 'denied',
    tests:
      'A registered user with no organisation relationships at all — no roles ' +
      'in the token, no organisation picker, no access.'
  },
  {
    email: 'word.status@bng.example.com',
    firstName: 'Wade',
    lastName: 'Wordstatus',
    loa: '1',
    aal: '1',
    relationships: [
      {
        org: 'Stubby Stub Ltd',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        // Deliberately a WORD, mimicking the stub's registration UI. The
        // hardened parser drops a non-numeric status rather than crashing.
        status: 'complete'
      }
    ],
    expect: 'denied',
    tests:
      'Reproduces the stub-UI quirk: status sent as the word "complete" ' +
      'instead of "3". The role is dropped (not parsed to NaN), so the user ' +
      'is denied — a clean /auth/forbidden rather than a 500.'
  },
  {
    email: 'org.mismatch@bng.example.com',
    firstName: 'Sam',
    lastName: 'Scoped',
    loa: '2',
    aal: '1',
    relationships: [
      {
        org: 'Northfield Estates',
        role: RELATIONSHIP.EMPLOYEE,
        roleName: COMPLETER,
        status: STATUS.PENDING
      },
      {
        org: 'Southbank Ecology',
        role: RELATIONSHIP.AGENT,
        roleName: COMPLETER,
        status: STATUS.APPROVED
      }
    ],
    expect: 'mixed',
    tests:
      'Per-relationship scoping: pick Northfield Estates (pending) and you ' +
      'are denied; pick Southbank Ecology (approved) and you get access. The ' +
      'approved role only counts for its own organisation.'
  }
]

// --- Helpers -----------------------------------------------------------------

// Fixed namespace so ids are stable across runs (and across machines).
const UUID_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'
const UUID_VERSION_MASK = 0x0f
const UUID_VERSION_5 = 0x50
const UUID_VARIANT_MASK = 0x3f
const UUID_VARIANT_RFC = 0x80

// Deterministic UUIDv5 from a name, so the same email always yields the same
// user id and the stub replaces rather than duplicates on re-run.
function deterministicUuid(name) {
  const namespace = Buffer.from(UUID_NAMESPACE.replaceAll('-', ''), 'hex')
  const bytes = createHash('sha1').update(namespace).update(name).digest()
  const id = bytes.subarray(0, 16)
  id[6] = (id[6] & UUID_VERSION_MASK) | UUID_VERSION_5
  id[8] = (id[8] & UUID_VARIANT_MASK) | UUID_VARIANT_RFC
  const hex = id.toString('hex')
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  )
}

function buildPayload(user) {
  const relationships = user.relationships.map((rel, index) => {
    const relationship = {
      relationshipId: deterministicUuid(`${user.email}|relationship|${index}`),
      organisationName: rel.org,
      relationshipRole: rel.role
    }
    if (rel.roleName) {
      relationship.roleName = rel.roleName
      relationship.roleStatus = rel.status
    }
    return relationship
  })

  const roleCount = relationships.filter((rel) => rel.roleName).length

  return {
    userId: deterministicUuid(user.email),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    loa: user.loa ?? '1',
    aal: user.aal ?? '1',
    // The stub validates these as POSITIVE integers, so the floor is 1 even
    // for a user with no enrolments.
    enrolmentCount: user.enrolmentCount ?? Math.max(1, roleCount),
    enrolmentRequestCount: user.enrolmentRequestCount ?? 1,
    relationships
  }
}

function describeSettings(user) {
  if (!user.relationships.length) {
    return 'no relationships (no organisation context)'
  }
  return user.relationships
    .map((rel) => {
      if (!rel.roleName) {
        return `${rel.role} @ ${rel.org} — no role`
      }
      const label =
        STATUS_LABEL[rel.status] ?? 'non-numeric — dropped by parser'
      return `${rel.role} @ ${rel.org} — "${rel.roleName}" status ${rel.status} (${label})`
    })
    .join('; ')
}

function parseArgs(argv) {
  const urlArg = argv.find((arg) => arg.startsWith('--url='))
  return {
    help: argv.includes('--help') || argv.includes('-h'),
    dryRun: argv.includes('--dry-run'),
    url:
      urlArg?.slice('--url='.length) ??
      process.env.DEFRA_ID_STUB_URL ??
      DEFAULT_STUB_URL
  }
}

function printHelp() {
  console.log(
    [
      'Seed test users into the local CDP Defra ID stub.',
      '',
      'Usage:',
      '  node scripts/seed-stub-users.mjs [--dry-run] [--url=<stubUrl>]',
      '',
      'Options:',
      '  --dry-run        Print the payloads without calling the stub.',
      '  --url=<stubUrl>  Stub base URL (default: ' + DEFAULT_STUB_URL + ').',
      '                   Also settable via DEFRA_ID_STUB_URL.',
      '  --help, -h       Show this help.'
    ].join('\n')
  )
}

async function preflight(baseUrl) {
  try {
    await fetch(`${baseUrl}/.well-known/openid-configuration`)
  } catch {
    console.error(`\nCannot reach the Defra ID stub at ${baseUrl}`)
    console.error('Start the supporting services from the backend repo:')
    console.error(
      '  (cd ../bng-metric-backend && docker compose up -d cdp-defra-id-stub)\n'
    )
    process.exit(1)
  }
}

async function postRegister(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/API/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status} ${detail}`.trim())
  }
}

// Remove one relationship by id. The stub filters ALL occurrences of the id from
// its per-user list, so this also clears any duplicates. No-op if absent.
async function removeRelationship(baseUrl, userId, relationshipId) {
  const path = `register/${userId}/relationship/${relationshipId}/remove`
  await fetch(`${baseUrl}/${path}`)
}

async function registerUser(baseUrl, payload) {
  let existed = false
  try {
    const probe = await fetch(`${baseUrl}/API/register/${payload.userId}`)
    existed = probe.status === 200
  } catch {
    // Ignore — the calls below surface any real connectivity problem.
  }

  // The stub adds a payload's relationships in parallel through a non-atomic
  // cached list, so two-or-more relationships in one POST race (all but one are
  // lost) and re-runs append duplicates rather than replacing. So instead:
  //   1. clear this user's relationships one id at a time (ids are deterministic,
  //      so we always know which to remove, and removal clears duplicates);
  //   2. POST the relationships one at a time. Each conflicting POST drops the
  //      registration record but keeps the relationships already added, so they
  //      accumulate to exactly the intended set without racing.
  // This keeps re-runs idempotent. A user with no relationships needs one POST.
  for (const { relationshipId } of payload.relationships) {
    await removeRelationship(baseUrl, payload.userId, relationshipId)
  }

  const { relationships } = payload
  if (relationships.length <= 1) {
    await postRegister(baseUrl, payload)
  } else {
    for (const relationship of relationships) {
      await postRegister(baseUrl, { ...payload, relationships: [relationship] })
    }
  }

  return { existed }
}

// --- Summary output ----------------------------------------------------------

const GROUPS = [
  { key: 'access', heading: 'ACCESS GRANTED — reaches the service' },
  { key: 'denied', heading: 'ACCESS DENIED — redirected to /auth/forbidden' },
  {
    key: 'mixed',
    heading: 'DEPENDS ON THE ORGANISATION PICKED at login'
  }
]

function printLoginInstructions(baseUrl) {
  console.log('How to log in as one of these users:')
  console.log(
    '  1. Run the stack (stub + backend + frontend), e.g. npm run dev'
  )
  console.log('     in the harness, with the backend compose services up.')
  console.log('  2. Open the frontend (http://localhost:3000) and sign in.')
  console.log('  3. On the Defra ID stub login page, click the email below.')
  console.log('  4. Users with two organisations get an organisation picker.')
  console.log(
    '  Note: the stub remembers the last user (SSO). To switch users, use the'
  )
  console.log(
    `  "Expire" link on the stub login page (${baseUrl}/login) or a fresh`
  )
  console.log('  private/incognito window.')
  console.log('')
}

function printSummary(baseUrl, registered) {
  const line = '='.repeat(72)
  console.log(`\n${line}`)
  console.log('Stub test users — login emails')
  console.log(line)
  console.log('')
  printLoginInstructions(baseUrl)

  for (const group of GROUPS) {
    const members = registered.filter(
      (entry) => entry.user.expect === group.key
    )
    if (!members.length) {
      continue
    }
    console.log(group.heading)
    console.log('-'.repeat(group.heading.length))
    for (const { user } of members) {
      console.log(`  ${user.email}`)
      console.log(
        `    Settings: loa ${user.loa ?? '1'}, aal ${user.aal ?? '1'} — ` +
          describeSettings(user)
      )
      console.log(`    Tests:    ${user.tests}`)
      console.log('')
    }
  }
  console.log(line)
}

// --- Main --------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const baseUrl = args.url.replace(/\/+$/, '')

  if (args.dryRun) {
    console.log(
      `Dry run — payloads for ${USERS.length} users (nothing sent):\n`
    )
    for (const user of USERS) {
      console.log(JSON.stringify(buildPayload(user), null, 2))
    }
    printSummary(
      baseUrl,
      USERS.map((user) => ({ user }))
    )
    return
  }

  await preflight(baseUrl)

  console.log(`Registering ${USERS.length} users at ${baseUrl}/API/register\n`)

  const registered = []
  const failures = []
  for (const user of USERS) {
    try {
      const { existed } = await registerUser(baseUrl, buildPayload(user))
      registered.push({ user })
      console.log(`  ${existed ? 'replaced' : 'created '}  ${user.email}`)
    } catch (error) {
      failures.push({ user, error })
      console.error(`  failed    ${user.email}: ${error.message}`)
    }
  }

  if (registered.length) {
    printSummary(baseUrl, registered)
  }

  if (failures.length) {
    console.error(`\n${failures.length} user(s) failed to register.`)
    process.exit(1)
  }
}

await main()
