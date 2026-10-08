import { renderTemplate } from '../../../test-helpers/render-template.js'
import { runInNewContext } from 'node:vm'
import {
  googleAnalyticsConsentScript,
  googleTagManagerScript
} from '../../helpers/google-tag-manager.js'

const projectsNavItem = {
  text: 'Projects',
  href: '/manage-projects',
  current: false
}

describe('Google Tag Manager layout', () => {
  test.each([
    'home/index.njk',
    'projects/index.njk',
    'project-summary/index.njk',
    'upload-received/upload-received.njk'
  ])('loads the supplied container on %s', (template) => {
    const html = renderTemplate(template, {
      googleTagManager: {
        enabled: true,
        consentScript: googleAnalyticsConsentScript,
        script: googleTagManagerScript
      },
      projectId: 'test-project',
      projectName: 'A private project',
      user: { email: 'private@example.com' }
    })
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
      (match) => match[1]
    )
    const [consentScript, script] = scripts
    expect(consentScript).toBe(googleAnalyticsConsentScript)
    expect(script).toBe(googleTagManagerScript)
    expect(html.indexOf(script)).toBeLessThan(html.indexOf('csrf-token'))
    expect(html).toContain(
      'https://www.googletagmanager.com/ns.html?id=GTM-K5LRK3HR"'
    )
    expect(html.indexOf('Google Tag Manager (noscript)')).toBeGreaterThan(
      html.indexOf('<body')
    )
    expect(html.indexOf('Google Tag Manager (noscript)')).toBeLessThan(
      html.indexOf('Skip to main content')
    )

    const inserted = []
    const existingEvent = { event: 'existing' }
    const window = { dataLayer: [existingEvent] }
    const document = {
      getElementsByTagName: () => [
        { parentNode: { insertBefore: (element) => inserted.push(element) } }
      ],
      createElement: () => ({})
    }
    runInNewContext(consentScript, { window })
    expect(window.dataLayer[0]).toBe(existingEvent)
    expect(Array.from(window.dataLayer[1]).slice(0, 2)).toEqual([
      'consent',
      'default'
    ])
    expect(JSON.parse(JSON.stringify(window.dataLayer[1][2]))).toEqual({
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    })
    runInNewContext(script, { window, document })
    expect(inserted).toEqual([
      {
        async: true,
        src: 'https://www.googletagmanager.com/gtm.js?id=GTM-K5LRK3HR'
      }
    ])
    expect(Object.keys(window.dataLayer[2]).sort()).toEqual([
      'event',
      'gtm.start'
    ])
    expect(window.dataLayer[2].event).toBe('gtm.js')
  })

  test.each([
    undefined,
    {
      enabled: false,
      consentScript: googleAnalyticsConsentScript,
      script: googleTagManagerScript
    }
  ])(
    'omits both snippets when GTM is disabled or missing',
    (googleTagManager) => {
      const html = renderTemplate('home/index.njk', { googleTagManager })
      expect(html).not.toContain('googletagmanager.com')
      expect(html).not.toContain('GTM-K5LRK3HR')
      expect(html).not.toContain('analytics_storage')
    }
  )
})

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
