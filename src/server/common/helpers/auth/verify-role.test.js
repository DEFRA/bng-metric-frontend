import { describe, expect, test, vi } from 'vitest'

import { hasBngCompleterRole, requireBngCompleterRole } from './verify-role.js'

describe('#hasBngCompleterRole', () => {
  test('returns true when a relationship has roleName "bng completer"', () => {
    const user = {
      relationships: [{ roleName: 'other role' }, { roleName: 'bng completer' }]
    }
    expect(hasBngCompleterRole(user)).toBe(true)
  })

  test('matches case-insensitively and trims whitespace', () => {
    const user = {
      relationships: [{ roleName: '  BNG Completer  ' }]
    }
    expect(hasBngCompleterRole(user)).toBe(true)
  })

  test('returns false when no relationship matches', () => {
    const user = {
      relationships: [{ roleName: 'viewer' }, { roleName: 'editor' }]
    }
    expect(hasBngCompleterRole(user)).toBe(false)
  })

  test('returns false when relationships is missing', () => {
    expect(hasBngCompleterRole({ sub: 'x' })).toBe(false)
  })

  test('returns false when relationships is not an array', () => {
    expect(hasBngCompleterRole({ relationships: 'nope' })).toBe(false)
  })

  test('returns false when user is null or undefined', () => {
    expect(hasBngCompleterRole(null)).toBe(false)
    expect(hasBngCompleterRole(undefined)).toBe(false)
  })
})

describe('#requireBngCompleterRole', () => {
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
      auth: { credentials: { relationships: [{ roleName: 'bng completer' }] } }
    }

    const result = requireBngCompleterRole.method(request, h)

    expect(result).toBe(h.continue)
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('redirects to /auth/forbidden and takes over when the role is missing', () => {
    const h = buildToolkit()
    const request = { auth: { credentials: { relationships: [] } } }

    const result = requireBngCompleterRole.method(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
    expect(h.takeover).toHaveBeenCalled()
    expect(result).toBe('takeover-response')
  })

  test('redirects when credentials are missing entirely', () => {
    const h = buildToolkit()
    const request = { auth: {} }

    requireBngCompleterRole.method(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/auth/forbidden')
  })
})
