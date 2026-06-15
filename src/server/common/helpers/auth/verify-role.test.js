import { describe, expect, test, vi } from 'vitest'

import { hasBngCompleterRole, requireBngCompleterRole } from './verify-role.js'

describe('#hasBngCompleterRole', () => {
  test('returns true for an approved (status 3) bng completer role', () => {
    const user = {
      roles: ['aaa-bbb:Certifier:3', 'ccc-ddd:bng completer:3']
    }
    expect(hasBngCompleterRole(user)).toBe(true)
  })

  test('returns false when the bng completer role is pending (status 1)', () => {
    const user = {
      roles: ['aaa-bbb:Certifier:3', 'ccc-ddd:bng completer:1']
    }
    expect(hasBngCompleterRole(user)).toBe(false)
  })

  test.each([1, 2, 4, 5, 6, 7])(
    'returns false for a bng completer role with non-approved status %s',
    (status) => {
      expect(
        hasBngCompleterRole({ roles: [`ccc-ddd:bng completer:${status}`] })
      ).toBe(false)
    }
  )

  test('matches case-insensitively and trims whitespace', () => {
    const user = {
      roles: ['aaa-bbb: BNG Completer :3']
    }
    expect(hasBngCompleterRole(user)).toBe(true)
  })

  test('requires the approved role to be for the current relationship when set', () => {
    const user = {
      currentRelationshipId: 'rel-b',
      roles: ['rel-a:bng completer:3']
    }
    expect(hasBngCompleterRole(user)).toBe(false)
  })

  test('passes when the approved role matches the current relationship', () => {
    const user = {
      currentRelationshipId: 'rel-a',
      roles: ['rel-a:bng completer:3', 'rel-b:bng completer:1']
    }
    expect(hasBngCompleterRole(user)).toBe(true)
  })

  test('any approved role suffices when there is no current relationship', () => {
    const user = { roles: ['rel-a:bng completer:3'] }
    expect(hasBngCompleterRole(user)).toBe(true)
  })

  test('returns false when no role is a bng completer', () => {
    const user = {
      roles: ['aaa-bbb:Certifier:3', 'ccc-ddd:Viewer:3']
    }
    expect(hasBngCompleterRole(user)).toBe(false)
  })

  test('returns false when roles is missing', () => {
    expect(hasBngCompleterRole({ sub: 'x' })).toBe(false)
  })

  test('returns false when roles is not an array', () => {
    expect(hasBngCompleterRole({ roles: 'nope' })).toBe(false)
  })

  test('returns false when user is null or undefined', () => {
    expect(hasBngCompleterRole(null)).toBe(false)
    expect(hasBngCompleterRole(undefined)).toBe(false)
  })

  test('handles malformed role entries gracefully', () => {
    const user = { roles: ['no-colons', '', 123, null] }
    expect(hasBngCompleterRole(user)).toBe(false)
  })
})

describe('#requireBngCompleterRole', () => {
  const mockLogger = { debug: vi.fn(), warn: vi.fn() }

  const buildToolkit = () => {
    const continueSymbol = Symbol('continue')
    const takeover = vi.fn().mockReturnValue('takeover-response')
    const redirect = vi.fn().mockReturnValue({ takeover })
    return {
      continue: continueSymbol,
      redirect,
      takeover
    }
  }

  test('calls h.continue when the user has an approved role', () => {
    const h = buildToolkit()
    const request = {
      auth: { credentials: { roles: ['aaa:bng completer:3'] } },
      logger: mockLogger
    }

    const result = requireBngCompleterRole.method(request, h)

    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('redirects to /auth/forbidden when the role is only pending (status 1)', () => {
    const h = buildToolkit()
    const request = {
      auth: { credentials: { roles: ['aaa:bng completer:1'] } },
      logger: mockLogger
    }

    const result = requireBngCompleterRole.method(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
    expect(h.takeover).toHaveBeenCalled()
    expect(result).toBe('takeover-response')
  })

  test('redirects to /auth/forbidden when the role is missing', () => {
    const h = buildToolkit()
    const request = {
      auth: { credentials: { roles: ['aaa:Viewer:3'] } },
      logger: mockLogger
    }

    const result = requireBngCompleterRole.method(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
    expect(result).toBe('takeover-response')
  })

  test('redirects when credentials are missing entirely', () => {
    const h = buildToolkit()
    const request = { auth: {}, logger: mockLogger }

    requireBngCompleterRole.method(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })
})
