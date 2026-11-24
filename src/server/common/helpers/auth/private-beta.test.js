import { describe, expect, test, vi } from 'vitest'

import {
  isOnPrivateBetaList,
  logPrivateBetaState,
  normaliseEmail,
  parseAllowList,
  PRIVATE_BETA_PATH
} from './private-beta.js'

const LISTED = 'jo.bloggs@example.com'

function buildLogger() {
  return { info: vi.fn(), warn: vi.fn() }
}

function everythingLogged(logger) {
  return JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls])
}

describe('#normaliseEmail', () => {
  test('trims and lower-cases an address', () => {
    expect(normaliseEmail('  Jo.Bloggs@Example.COM ')).toBe(LISTED)
  })

  test.each([undefined, null, 42, {}])(
    'returns an empty string for %s',
    (value) => {
      expect(normaliseEmail(value)).toBe('')
    }
  )
})

describe('#parseAllowList', () => {
  test.each([undefined, null, '', '   '])(
    'turns the filter off when the value is %j',
    (raw) => {
      const list = parseAllowList(raw)
      expect(list.enabled).toBe(false)
      expect(list.emails.size).toBe(0)
      expect(list.rejected).toBe(0)
    }
  )

  test('trims and lower-cases each entry (AC5)', () => {
    const list = parseAllowList(' Jo.Bloggs@Example.com ')
    expect([...list.emails]).toEqual([LISTED])
  })

  test('skips empty entries, such as one from a trailing comma, without counting them', () => {
    const list = parseAllowList(`${LISTED}, ,,a@b.co,`)
    expect([...list.emails]).toEqual([LISTED, 'a@b.co'])
    expect(list.rejected).toBe(0)
  })

  test('removes duplicates', () => {
    const list = parseAllowList(`${LISTED},JO.BLOGGS@example.com`)
    expect(list.emails.size).toBe(1)
  })

  test.each([
    'not-an-email',
    'no-domain@',
    '@example.com',
    'jo@localhost',
    'jo@example.',
    'jo@.com',
    'jo@@example.com',
    'jo bloggs@example.com'
  ])('rejects %j (AC6)', (entry) => {
    const list = parseAllowList(`${entry},${LISTED}`)
    expect([...list.emails]).toEqual([LISTED])
    expect(list.rejected).toBe(1)
  })

  test('accepts plausible addresses with subdomains and plus tags', () => {
    const list = parseAllowList('a.b+bng@mail.defra.gov.uk')
    expect(list.emails.has('a.b+bng@mail.defra.gov.uk')).toBe(true)
  })

  test('keeps the filter on when every entry is rejected, so a mistyped secret denies rather than opens', () => {
    const list = parseAllowList('not-an-email')
    expect(list.enabled).toBe(true)
    expect(list.emails.size).toBe(0)
    expect(isOnPrivateBetaList({ email: 'anyone@example.com' }, list)).toBe(
      false
    )
  })
})

describe('#isOnPrivateBetaList', () => {
  const list = parseAllowList(` Jo.Bloggs@Example.com , not-an-email`)

  test('lets everyone through when the filter is off (AC4)', () => {
    const off = parseAllowList('')
    expect(isOnPrivateBetaList({ email: 'anyone@example.com' }, off)).toBe(true)
    expect(isOnPrivateBetaList({}, off)).toBe(true)
  })

  test('matches regardless of case and spaces in the claim (AC5)', () => {
    expect(isOnPrivateBetaList({ email: LISTED }, list)).toBe(true)
    expect(
      isOnPrivateBetaList({ email: ' JO.BLOGGS@EXAMPLE.COM ' }, list)
    ).toBe(true)
  })

  test('denies an address that is not on the list', () => {
    expect(isOnPrivateBetaList({ email: 'someone@example.com' }, list)).toBe(
      false
    )
  })

  test.each([
    ['no claims', undefined],
    ['no email claim (AC11)', { sub: 'user-1' }],
    ['an empty email claim', { email: '' }],
    ['a non-string email claim', { email: ['jo.bloggs@example.com'] }]
  ])('denies a user with %s', (_name, user) => {
    expect(isOnPrivateBetaList(user, list)).toBe(false)
  })

  test('uses the list read at start-up by default: off in tests, where the variable is unset', () => {
    expect(isOnPrivateBetaList({ email: 'anyone@example.com' })).toBe(true)
  })
})

describe('#logPrivateBetaState', () => {
  test('logs that the filter is off when the variable is not set', () => {
    const logger = buildLogger()
    logPrivateBetaState(logger, parseAllowList(''))
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Private Beta filter is off')
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('logs that the filter is on, with the number of entries and no addresses (AC7)', () => {
    const raw = 'a@example.com,b@example.com,c@example.com'
    const logger = buildLogger()
    logPrivateBetaState(logger, parseAllowList(raw))
    expect(logger.info).toHaveBeenCalledWith(
      'Private Beta filter is on, with 3 entries (0 rejected)'
    )
    expect(logger.warn).not.toHaveBeenCalled()
    for (const email of raw.split(',')) {
      expect(everythingLogged(logger)).not.toContain(email)
    }
  })

  test('logs the number of rejected entries, not their values (AC6)', () => {
    const logger = buildLogger()
    logPrivateBetaState(logger, parseAllowList(`not-an-email,${LISTED}`))
    expect(logger.info).toHaveBeenCalledWith(
      'Private Beta filter is on, with 1 entries (1 rejected)'
    )
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('rejected 1 entries')
    )
    expect(everythingLogged(logger)).not.toContain('not-an-email')
    expect(everythingLogged(logger)).not.toContain(LISTED)
  })
})

test('the drop-out page lives under /auth', () => {
  expect(PRIVATE_BETA_PATH).toBe('/auth/private-beta')
})
