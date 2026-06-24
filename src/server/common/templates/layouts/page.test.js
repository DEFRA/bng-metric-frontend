import { renderTemplate } from '../../../test-helpers/render-template.js'

describe('page layout navigation', () => {
  test('shows the change organisation link for authenticated users who can reselect', () => {
    const html = renderTemplate('home/index.njk', {
      isAuthenticated: true,
      user: { email: 'test@example.com' },
      canSelectDifferentOrganisation: true
    })

    expect(html).toContain('Change organisation')
    expect(html).toContain('href="/auth/login?forceReselection=true"')
    expect(html).toContain('Sign out')
    expect(html).toContain('href="/auth/logout"')
  })

  test('hides the change organisation link when reselection is not available', () => {
    const html = renderTemplate('home/index.njk', {
      isAuthenticated: true,
      user: { email: 'test@example.com' },
      canSelectDifferentOrganisation: false
    })

    expect(html).not.toContain('Change organisation')
    expect(html).not.toContain('forceReselection=true')
    expect(html).toContain('Sign out')
  })
})
