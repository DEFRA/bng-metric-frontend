import { describe, expect, test, vi } from 'vitest'

import { hasBngCompleterRole, requireBngCompleterRole } from './verify-role.js'

describe('#hasBngCompleterRole', () => {
  test('returns true when a role entry contains "bng completer"', () => {
    const user = {
      roles: ['aaa-bbb:Certifier:3', 'ccc-ddd:bng completer:1']
    }
    expect(hasBngCompleterRole(user)).toBe(true)
  })

  test('matches case-insensitively and trims whitespace', () => {
    const user = {
      roles: ['aaa-bbb: BNG Completer :1']
    }
    expect(hasBngCompleterRole(user)).toBe(true)
  })

  test('returns false when no role matches', () => {
    const user = {
      roles: ['aaa-bbb:Certifier:3', 'ccc-ddd:Viewer:1']
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
  const mockLogger = { debug: vi.fn() }

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

  test('calls h.continue when the user has the role', () => {
    const h = buildToolkit()
    const request = {
      auth: { credentials: { roles: ['aaa:bng completer:1'] } },
      logger: mockLogger
    }

    const result = requireBngCompleterRole.method(request, h)

    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('redirects to /auth/forbidden when the role is missing', () => {
    const h = buildToolkit()
    const request = {
      auth: { credentials: { roles: ['aaa:Viewer:1'] } },
      logger: mockLogger
    }

    const result = requireBngCompleterRole.method(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
    expect(h.takeover).toHaveBeenCalled()
    expect(result).toBe('takeover-response')
  })

  test('redirects when credentials are missing entirely', () => {
    const h = buildToolkit()
    const request = { auth: {}, logger: mockLogger }

    requireBngCompleterRole.method(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })
})
