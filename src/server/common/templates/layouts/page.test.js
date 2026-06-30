import { renderTemplate } from '../../../test-helpers/render-template.js'

const projectsNavItem = {
  text: 'Projects',
  href: '/manage-projects',
  current: false
}

describe('page layout navigation', () => {
  test('shows the change organisation link for authenticated users who can reselect', () => {
    const html = renderTemplate('home/index.njk', {
      isAuthenticated: true,
      user: { email: 'test@example.com' },
      navigation: [projectsNavItem],
      canSelectDifferentOrganisation: true
    })

    expect(html).toContain('Projects')
    expect(html).toContain('href="/manage-projects"')
    expect(html).toContain('Change organisation')
    expect(html).toContain('href="/auth/login?forceReselection=true"')
    expect(html).toContain('Sign out')
    expect(html).toContain('href="/auth/logout"')
  })

  test('hides the change organisation link when reselection is not available', () => {
    const html = renderTemplate('home/index.njk', {
      isAuthenticated: true,
      user: { email: 'test@example.com' },
      navigation: [projectsNavItem],
      canSelectDifferentOrganisation: false
    })

    expect(html).toContain('Projects')
    expect(html).toContain('href="/manage-projects"')
    expect(html).not.toContain('Change organisation')
    expect(html).not.toContain('forceReselection=true')
    expect(html).toContain('Sign out')
  })

  test('hides the projects link for unauthenticated users', () => {
    const html = renderTemplate('home/index.njk', {
      isAuthenticated: false
    })

    expect(html).not.toContain('Projects')
    expect(html).not.toContain('href="/manage-projects"')
    expect(html).not.toContain('Sign out')
  })
})
